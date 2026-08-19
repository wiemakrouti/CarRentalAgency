import { Prisma } from '@prisma/client';
import type {
  ActivateRentalInput,
  CancelRentalInput,
  CreateRentalInput,
  ExtendRentalInput,
  ReturnRentalInput,
} from '@car-rental/shared';
import { prisma } from '../lib/prisma-client.js';
import { AppError } from '../utils/app-error.js';
import { RentalsRepository } from '../repositories/rentals.repository.js';
import { CarsRepository } from '../repositories/cars.repository.js';
import { PaymentsRepository } from '../repositories/payments.repository.js';
import { RentalExtensionsRepository } from '../repositories/rental-extensions.repository.js';
import { CarsService } from './cars.service.js';
import { ClientsService } from './clients.service.js';
import { AuditService } from './audit.service.js';
import type { RentalListQuery } from '../validators/rental.validator.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const MAX_RENTAL_NUMBER_ATTEMPTS = 5;
const LIFECYCLE_ISOLATION = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

// Auto-generated charges (late fee, extension) have no payment-collection UI
// yet (Phase 5) — CASH is a placeholder method and PENDING reflects that the
// amount is owed but not actually collected. Corrected/settled in Phase 5.
const AUTO_PAYMENT_METHOD = 'CASH';
const AUTO_PAYMENT_STATUS = 'PENDING';

function generateRentalNumber(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LOC-${datePart}-${randomPart}`;
}

// Nights, not calendar days: a pickup and return on the same day is a
// same-day rental (still billed as 1 night), not zero.
function calculateNights(pickupDate: Date, plannedReturnDate: Date): number {
  const nights = Math.ceil((plannedReturnDate.getTime() - pickupDate.getTime()) / MS_PER_DAY);
  return Math.max(nights, 1);
}

export const RentalsService = {
  async list(query: RentalListQuery) {
    const { items, total } = await RentalsRepository.findMany(query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getById(id: string, options?: { includeArchived?: boolean }) {
    const rental = await RentalsRepository.findById(id, options);
    if (!rental) {
      throw new AppError(404, 'RENTAL_NOT_FOUND', 'Location introuvable.');
    }
    return rental;
  },

  async create(input: CreateRentalInput, userId: string, ipAddress?: string) {
    const car = await CarsService.getById(input.carId);
    await ClientsService.getById(input.clientId);

    if (car.status !== 'AVAILABLE') {
      throw new AppError(
        409,
        'CAR_NOT_AVAILABLE',
        `Cette voiture n'est pas disponible actuellement (statut : ${car.status}).`,
      );
    }

    const overlapping = await RentalsRepository.hasOverlap(input.carId, {
      pickupDate: input.pickupDate,
      returnDate: input.plannedReturnDate,
    });
    if (overlapping) {
      throw new AppError(409, 'CAR_NOT_AVAILABLE', 'Cette voiture est déjà réservée pour ces dates.');
    }

    const setting = await prisma.setting.findFirst();
    const depositAmount = input.depositAmount ?? Number(setting?.defaultDepositAmount ?? 0);
    const nights = calculateNights(input.pickupDate, input.plannedReturnDate);
    const totalAmount = Number(car.dailyRate) * nights;

    for (let attempt = 0; attempt < MAX_RENTAL_NUMBER_ATTEMPTS; attempt += 1) {
      const rentalNumber = generateRentalNumber();
      try {
        return await prisma.$transaction(async (tx) => {
          const rental = await RentalsRepository.create(
            {
              rentalNumber,
              carId: input.carId,
              clientId: input.clientId,
              pickupDate: input.pickupDate,
              plannedReturnDate: input.plannedReturnDate,
              dailyRate: car.dailyRate,
              totalAmount,
              depositAmount,
              notes: input.notes ?? null,
              createdByUserId: userId,
            },
            tx,
          );
          await AuditService.record(tx, {
            userId,
            action: 'CREATE',
            entityType: 'Rental',
            entityId: rental.id,
            after: rental,
            ipAddress,
          });
          return rental;
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) {
          continue;
        }
        throw err;
      }
    }

    throw new AppError(500, 'RENTAL_NUMBER_GENERATION_FAILED', 'Impossible de générer un numéro de location.');
  },

  async activate(id: string, input: ActivateRentalInput, userId: string, ipAddress?: string) {
    const rental = await RentalsService.getById(id);

    if (rental.status !== 'RESERVED') {
      throw new AppError(
        409,
        'INVALID_RENTAL_STATE',
        `Impossible d'activer une location au statut ${rental.status}.`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const rentalGuarded = await RentalsRepository.updateGuarded(
        id,
        ['RESERVED'],
        {
          status: 'ACTIVE',
          mileageAtPickup: input.mileageAtPickup,
          fuelLevelAtPickup: input.fuelLevelAtPickup,
        },
        tx,
      );
      if (!rentalGuarded) {
        throw new AppError(
          409,
          'INVALID_RENTAL_STATE',
          'Cette location a été modifiée entre-temps, veuillez réessayer.',
        );
      }

      const carGuarded = await CarsRepository.updateStatusGuarded(
        rental.carId,
        ['AVAILABLE'],
        { status: 'RENTED' },
        tx,
      );
      if (!carGuarded) {
        throw new AppError(
          409,
          'CAR_NOT_AVAILABLE',
          "Cette voiture n'est pas disponible pour la prise en charge actuellement.",
        );
      }

      const updated = await RentalsRepository.findById(id, undefined, tx);
      await AuditService.record(tx, {
        userId,
        action: 'RENTAL_ACTIVATE',
        entityType: 'Rental',
        entityId: id,
        before: rental,
        after: updated,
        ipAddress,
      });
      return updated;
    }, LIFECYCLE_ISOLATION);
  },

  async returnRental(id: string, input: ReturnRentalInput, userId: string, ipAddress?: string) {
    const rental = await RentalsService.getById(id);

    if (rental.status !== 'ACTIVE') {
      throw new AppError(
        409,
        'INVALID_RENTAL_STATE',
        `Impossible de clôturer une location au statut ${rental.status}.`,
      );
    }

    if (rental.mileageAtPickup !== null && input.mileageAtReturn < rental.mileageAtPickup) {
      throw new AppError(
        400,
        'INVALID_MILEAGE',
        'Le kilométrage au retour ne peut pas être inférieur au kilométrage au départ.',
      );
    }

    const actualReturnDate = new Date();
    const lateDays =
      actualReturnDate > rental.plannedReturnDate
        ? Math.ceil((actualReturnDate.getTime() - rental.plannedReturnDate.getTime()) / MS_PER_DAY)
        : 0;
    const lateFeeAmount = lateDays * Number(rental.dailyRate);

    return prisma.$transaction(async (tx) => {
      const rentalGuarded = await RentalsRepository.updateGuarded(
        id,
        ['ACTIVE'],
        {
          status: 'COMPLETED',
          actualReturnDate,
          mileageAtReturn: input.mileageAtReturn,
          fuelLevelAtReturn: input.fuelLevelAtReturn,
        },
        tx,
      );
      if (!rentalGuarded) {
        throw new AppError(
          409,
          'INVALID_RENTAL_STATE',
          'Cette location a été modifiée entre-temps, veuillez réessayer.',
        );
      }

      const carGuarded = await CarsRepository.updateStatusGuarded(
        rental.carId,
        ['RENTED'],
        { status: input.carStatusAfterReturn, mileage: input.mileageAtReturn },
        tx,
      );
      if (!carGuarded) {
        throw new AppError(
          409,
          'CAR_STATE_CONFLICT',
          "L'état de la voiture a changé de manière inattendue.",
        );
      }

      if (lateFeeAmount > 0) {
        await PaymentsRepository.create(
          {
            rentalId: id,
            amount: lateFeeAmount,
            method: AUTO_PAYMENT_METHOD,
            type: 'LATE_FEE',
            status: AUTO_PAYMENT_STATUS,
            notes: `Retard de ${lateDays} jour${lateDays > 1 ? 's' : ''}.`,
          },
          tx,
        );
      }

      if (input.damageFeeAmount) {
        await PaymentsRepository.create(
          {
            rentalId: id,
            amount: input.damageFeeAmount,
            method: AUTO_PAYMENT_METHOD,
            type: 'DAMAGE_FEE',
            status: AUTO_PAYMENT_STATUS,
            notes: input.damageFeeNotes ?? null,
          },
          tx,
        );
      }

      const updated = await RentalsRepository.findById(id, undefined, tx);
      await AuditService.record(tx, {
        userId,
        action: 'RENTAL_RETURN',
        entityType: 'Rental',
        entityId: id,
        before: rental,
        after: updated,
        ipAddress,
      });
      return updated;
    }, LIFECYCLE_ISOLATION);
  },

  async extend(id: string, input: ExtendRentalInput, userId: string, ipAddress?: string) {
    const rental = await RentalsService.getById(id);

    if (rental.status !== 'ACTIVE') {
      throw new AppError(
        409,
        'INVALID_RENTAL_STATE',
        `Impossible de prolonger une location au statut ${rental.status}.`,
      );
    }

    if (input.newReturnDate <= rental.plannedReturnDate) {
      throw new AppError(
        400,
        'INVALID_EXTENSION_DATE',
        'La nouvelle date de retour doit être postérieure à la date de retour actuelle.',
      );
    }

    const previousNights = calculateNights(rental.pickupDate, rental.plannedReturnDate);
    const newNights = calculateNights(rental.pickupDate, input.newReturnDate);
    const additionalAmount = (newNights - previousNights) * Number(rental.dailyRate);

    return prisma.$transaction(async (tx) => {
      const overlapping = await RentalsRepository.hasOverlap(
        rental.carId,
        { pickupDate: rental.pickupDate, returnDate: input.newReturnDate, excludeRentalId: id },
        tx,
      );
      if (overlapping) {
        throw new AppError(409, 'CAR_NOT_AVAILABLE', 'Cette voiture est déjà réservée pour ces dates.');
      }

      const rentalGuarded = await RentalsRepository.updateGuarded(
        id,
        ['ACTIVE'],
        {
          plannedReturnDate: input.newReturnDate,
          totalAmount: { increment: additionalAmount },
        },
        tx,
      );
      if (!rentalGuarded) {
        throw new AppError(
          409,
          'INVALID_RENTAL_STATE',
          'Cette location a été modifiée entre-temps, veuillez réessayer.',
        );
      }

      await RentalExtensionsRepository.create(
        {
          rentalId: id,
          previousReturnDate: rental.plannedReturnDate,
          newReturnDate: input.newReturnDate,
          additionalAmount,
        },
        tx,
      );

      await PaymentsRepository.create(
        {
          rentalId: id,
          amount: additionalAmount,
          method: AUTO_PAYMENT_METHOD,
          type: 'EXTENSION_PAYMENT',
          status: AUTO_PAYMENT_STATUS,
          notes: `Prolongation de ${newNights - previousNights} jour(s).`,
        },
        tx,
      );

      const updated = await RentalsRepository.findById(id, undefined, tx);
      await AuditService.record(tx, {
        userId,
        action: 'RENTAL_EXTEND',
        entityType: 'Rental',
        entityId: id,
        before: rental,
        after: updated,
        ipAddress,
      });
      return updated;
    }, LIFECYCLE_ISOLATION);
  },

  async cancel(id: string, input: CancelRentalInput, userId: string, ipAddress?: string) {
    const rental = await RentalsService.getById(id);

    if (rental.status !== 'RESERVED') {
      throw new AppError(
        409,
        'INVALID_RENTAL_STATE',
        `Impossible d'annuler une location au statut ${rental.status}.`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const rentalGuarded = await RentalsRepository.updateGuarded(
        id,
        ['RESERVED'],
        { status: 'CANCELLED', cancelledReason: input.cancelledReason ?? null },
        tx,
      );
      if (!rentalGuarded) {
        throw new AppError(
          409,
          'INVALID_RENTAL_STATE',
          'Cette location a été modifiée entre-temps, veuillez réessayer.',
        );
      }

      const updated = await RentalsRepository.findById(id, undefined, tx);
      await AuditService.record(tx, {
        userId,
        action: 'RENTAL_CANCEL',
        entityType: 'Rental',
        entityId: id,
        before: rental,
        after: updated,
        ipAddress,
      });
      return updated;
    });
  },
};
