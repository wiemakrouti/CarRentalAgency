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
import { startOfDay, startOfToday } from '../lib/date-utils.js';
import type { RentalListQuery } from '../validators/rental.validator.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const WRITE_CONFLICT = 'P2034';
const MAX_RENTAL_NUMBER_ATTEMPTS = 5;
const LIFECYCLE_ISOLATION = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

const AUTO_CANCEL_REASON = 'Annulée automatiquement — jamais récupérée avant la fin de la période réservée.';

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
  // A RESERVED rental whose plannedReturnDate has already passed means the
  // client never showed up at all — the whole originally-booked window is
  // in the past, not just the pickup. Left alone, "jours de retard sur la
  // remise des clés" would grow without bound on a reservation nobody will
  // ever activate. No cron/job runner in this app (see docs/architecture.md
  // §1) — instead this runs opportunistically from the two read paths an
  // admin actually watches (the table and the KPI header), so a stale
  // reservation gets swept within moments of anyone looking at the page,
  // same "compute cheaply on read" spirit as OVERDUE/PICKUP_OVERDUE
  // themselves. Safe to call redundantly: cancelExpiredReservations
  // re-checks status: 'RESERVED' itself, so calling this from both list()
  // and getSummary() on the same page load just no-ops the second time.
  async sweepExpiredReservations() {
    // Start of today, not `new Date()` — a reservation whose plannedReturnDate
    // is today hasn't actually expired until today is over.
    const expired = await RentalsRepository.findExpiredReservations(startOfToday());
    if (expired.length === 0) return 0;

    await prisma.$transaction(async (tx) => {
      await RentalsRepository.cancelExpiredReservations(
        expired.map((r) => r.id),
        AUTO_CANCEL_REASON,
        tx,
      );
      for (const rental of expired) {
        await AuditService.record(tx, {
          userId: null,
          action: 'RENTAL_AUTO_CANCEL',
          entityType: 'Rental',
          entityId: rental.id,
          before: rental,
          after: { ...rental, status: 'CANCELLED', cancelledReason: AUTO_CANCEL_REASON },
        });
      }
    });
    return expired.length;
  },

  async list(query: RentalListQuery) {
    await RentalsService.sweepExpiredReservations();
    const { items, total } = await RentalsRepository.findMany(query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getSummary() {
    await RentalsService.sweepExpiredReservations();
    return RentalsRepository.getSummaryCounts();
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

    // Fast-fail outside any transaction — a plain read, purely for a snappy
    // error on the common (non-racing) path. Not what actually prevents a
    // double-booking: two submissions for the same car/dates arriving close
    // together could both pass this exact check before either has inserted
    // anything. The authoritative guard is the re-check inside the
    // Serializable transaction below, same pattern extend() already uses
    // for its own overlap check.
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
          // The real guard: re-checked here, inside the same serializable
          // transaction as the insert, so two concurrent create() calls for
          // an overlapping car/date range can't both slip past the earlier
          // plain-read check and both succeed.
          const stillOverlapping = await RentalsRepository.hasOverlap(
            input.carId,
            { pickupDate: input.pickupDate, returnDate: input.plannedReturnDate },
            tx,
          );
          if (stillOverlapping) {
            throw new AppError(409, 'CAR_NOT_AVAILABLE', 'Cette voiture est déjà réservée pour ces dates.');
          }

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

          // A payment already collected at booking (the "Location immédiate"
          // tab's own Paiement section) — created here, in the same
          // transaction as the rental, so the two can never drift: either
          // both commit, or neither does.
          if (input.initialPayment) {
            await PaymentsRepository.create(
              {
                rentalId: rental.id,
                amount: input.initialPayment.amount,
                method: input.initialPayment.method,
                type: input.initialPayment.type,
                status: 'COMPLETED',
                paidAt: new Date(),
              },
              tx,
            );
          }

          // A walk-in client picking up the car right now (the "Location
          // immédiate" tab) skips the RESERVED state entirely — same
          // transaction as the creation, so the rental is never left
          // referencing keys that were never actually handed over (or vice
          // versa). No late-pickup recalculation here unlike activate():
          // totalAmount above was already computed from this same
          // pickupDate, so there's nothing to adjust.
          if (input.activation) {
            const activated = await RentalsRepository.updateGuarded(
              rental.id,
              ['RESERVED'],
              {
                status: 'ACTIVE',
                mileageAtPickup: input.activation.mileageAtPickup,
                fuelLevelAtPickup: input.activation.fuelLevelAtPickup,
              },
              tx,
            );
            if (!activated) {
              throw new AppError(
                500,
                'RENTAL_ACTIVATION_FAILED',
                "Erreur lors de l'activation automatique de la location.",
              );
            }

            const carActivated = await CarsRepository.updateStatusGuarded(
              input.carId,
              ['AVAILABLE'],
              { status: 'RENTED' },
              tx,
            );
            if (!carActivated) {
              throw new AppError(
                409,
                'CAR_NOT_AVAILABLE',
                "Cette voiture n'est plus disponible pour la prise en charge immédiate.",
              );
            }
          }

          await AuditService.record(tx, {
            userId,
            action: 'CREATE',
            entityType: 'Rental',
            entityId: rental.id,
            after: rental,
            ipAddress,
          });
          return RentalsRepository.findById(rental.id, undefined, tx);
        }, LIFECYCLE_ISOLATION);
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === UNIQUE_CONSTRAINT_VIOLATION) {
          continue;
        }
        // Postgres SERIALIZABLE aborts the losing side of a genuine race
        // instead of letting both transactions commit — without this, that
        // surfaces as a raw 500 instead of the same friendly conflict
        // message the non-racing path already throws above.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === WRITE_CONFLICT) {
          throw new AppError(409, 'CAR_NOT_AVAILABLE', 'Cette voiture vient d’être réservée, veuillez réessayer.');
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

    // Activation always records the moment the keys actually change hands,
    // not whatever pickupDate was originally booked — recalculated
    // unconditionally, not just for a late pickup. An early activation (the
    // client showing up well before their scheduled date) is allowed, not
    // blocked outright: it's only actually a problem if the car is already
    // committed elsewhere for that widened window (checked just below). An
    // on-time activation lands on the same night count either way
    // (calculateNights rounds up), so this never double-charges or
    // undercharges the common case.
    const now = new Date();
    const totalAmount = calculateNights(now, rental.plannedReturnDate) * Number(rental.dailyRate);

    return prisma.$transaction(async (tx) => {
      // An early activation widens the car's occupied window backward to
      // now, which the original booking's own overlap check never accounted
      // for — re-run it here, the same guard create()/extend() already run
      // for their own date-range changes. A late activation only narrows the
      // window, so it can never introduce a new conflict.
      if (now < rental.pickupDate) {
        const overlapping = await RentalsRepository.hasOverlap(
          rental.carId,
          { pickupDate: now, returnDate: rental.plannedReturnDate, excludeRentalId: id },
          tx,
        );
        if (overlapping) {
          throw new AppError(409, 'CAR_NOT_AVAILABLE', 'Cette voiture est déjà en location sur cette période.');
        }
      }

      const rentalGuarded = await RentalsRepository.updateGuarded(
        id,
        ['RESERVED'],
        {
          status: 'ACTIVE',
          pickupDate: now,
          totalAmount,
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
    // Full calendar days late — returning any time on the planned return day
    // itself is 0 days late, not 1: comparing the exact instant (the old
    // `actualReturnDate > plannedReturnDate` + Math.ceil) rounded any moment
    // past midnight of that day up to a full day late, charging a fee for a
    // return that was actually on time. Both sides go through startOfDay, not
    // just actualReturnDate — plannedReturnDate is stored as UTC midnight,
    // which for a positive UTC offset (Tunisia is UTC+1) sits an hour or more
    // *after* local midnight; leaving it untruncated silently rounded every
    // clean N-day gap down to N-1 (a genuinely 2-day-late return billed as 1).
    const lateDays = Math.max(
      0,
      Math.floor((startOfDay(actualReturnDate).getTime() - startOfDay(rental.plannedReturnDate).getTime()) / MS_PER_DAY),
    );
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
