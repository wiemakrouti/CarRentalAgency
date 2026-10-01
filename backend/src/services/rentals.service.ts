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
import { agencyDay, formatDateOnly } from '../lib/date-utils.js';
import { BOOKABLE_CAR_STATUSES } from '../lib/rental-availability.js';
import type { RentalListQuery, RentalOccupancyQuery } from '../validators/rental.validator.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const UNIQUE_CONSTRAINT_VIOLATION = 'P2002';
const WRITE_CONFLICT = 'P2034';
const MAX_RENTAL_NUMBER_ATTEMPTS = 5;
const LIFECYCLE_ISOLATION = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable };

const AUTO_CANCEL_REASON =
  'Annulée automatiquement — jamais récupérée avant la fin de la période réservée.';

// Auto-generated charges (late fee, extension) have no payment-collection UI
// yet (Phase 5) — CASH is a placeholder method and PENDING reflects that the
// amount is owed but not actually collected. Corrected/settled in Phase 5.
const AUTO_PAYMENT_METHOD = 'CASH';
const AUTO_PAYMENT_STATUS = 'PENDING';

function generateRentalNumber(): string {
  // The agency's own date (Tunis), not UTC's — otherwise a rental created
  // between 00:00 and 01:00 was numbered with the previous day.
  const datePart = formatDateOnly(agencyDay()).replace(/-/g, '');
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `LOC-${datePart}-${randomPart}`;
}

// Nights, not calendar days: a pickup and return on the same day is a
// same-day rental (still billed as 1 night), not zero.
function calculateNights(pickupDate: Date, plannedReturnDate: Date): number {
  const nights = Math.ceil((plannedReturnDate.getTime() - pickupDate.getTime()) / MS_PER_DAY);
  return Math.max(nights, 1);
}

// The odometer can't run backward: a pickup reading below the car's own
// recorded mileage is a typo (or the car's mileage was entered wrong), and
// letting it through would corrupt every later mileage check on this car.
function assertMileageNotBelowOdometer(mileageAtPickup: number, carMileage: number) {
  if (mileageAtPickup < carMileage) {
    throw new AppError(
      400,
      'MILEAGE_BELOW_ODOMETER',
      `Le kilométrage au départ (${mileageAtPickup.toLocaleString('fr-FR')} km) est inférieur au compteur de la voiture (${carMileage.toLocaleString('fr-FR')} km). Si le compteur enregistré est erroné, corrigez-le dans la fiche de la voiture.`,
    );
  }
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
  async sweepExpiredReservations(agencyId: string) {
    // Start of today, not `new Date()` — a reservation whose plannedReturnDate
    // is today hasn't actually expired until today is over. agencyDay (the
    // Tunis calendar day), the same "today" every other rental view uses.
    const expired = await RentalsRepository.findExpiredReservations(agencyId, agencyDay());
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

  async list(agencyId: string, query: RentalListQuery) {
    await RentalsService.sweepExpiredReservations(agencyId);
    const { items, total } = await RentalsRepository.findMany(agencyId, query);
    return { items, total, page: query.page, pageSize: query.pageSize };
  },

  async getSummary(agencyId: string) {
    await RentalsService.sweepExpiredReservations(agencyId);
    return RentalsRepository.getSummaryCounts(agencyId);
  },

  // Dashboard's occupancy heatmap: one { date, count } row per calendar day
  // in [from, to], `count` being how many cars were actually out that day.
  // Fetches the (small) set of candidate rentals once, then buckets them by
  // day in application code rather than running one query per day — the
  // range is at most MAX_OCCUPANCY_RANGE_DAYS (400) days, so this stays
  // cheap without needing raw SQL for per-day aggregation.
  async getOccupancy(agencyId: string, query: RentalOccupancyQuery) {
    // Already UTC-midnight of a calendar day (z.coerce.date() of a
    // "YYYY-MM-DD" query param) — the same representation pickupDate itself
    // uses, so no truncation needed here. startOfDay (local midnight) must
    // NOT be applied to these: on any server not running in UTC it shifts
    // them by the server's own offset, which used to make `to` disagree
    // with a rental's own `pickupDate` by up to a day (see startOfDayUTC's
    // comment in date-utils.ts).
    const { from, to } = query;
    const rentals = await RentalsRepository.findOccupancyRentals(agencyId, from, to);
    // An ongoing rental (no actualReturnDate yet) counts as occupying every
    // day up to and including today — never plannedReturnDate, which for an
    // overdue return already sits in the past while the car is still out.
    const ongoingEnd = new Date(agencyDay().getTime() + MS_PER_DAY);

    const days: { date: string; count: number }[] = [];
    for (
      let cursor = from;
      cursor.getTime() <= to.getTime();
      cursor = new Date(cursor.getTime() + MS_PER_DAY)
    ) {
      const count = rentals.reduce((total, rental) => {
        // Both truncated to their (Tunis) calendar day: actualReturnDate is
        // always a real timestamp, and so is pickupDate once activate() has
        // set it to the handover instant — compared raw, a car handed over
        // at 10:00 didn't count as out on its own pickup day.
        const pickup = agencyDay(rental.pickupDate);
        const end = rental.actualReturnDate ? agencyDay(rental.actualReturnDate) : ongoingEnd;
        return cursor.getTime() >= pickup.getTime() && cursor.getTime() < end.getTime()
          ? total + 1
          : total;
      }, 0);
      days.push({ date: formatDateOnly(cursor), count });
    }
    return days;
  },

  async getById(agencyId: string, id: string, options?: { includeArchived?: boolean }) {
    const rental = await RentalsRepository.findById(agencyId, id, options);
    if (!rental) {
      throw new AppError(404, 'RENTAL_NOT_FOUND', 'Location introuvable.');
    }
    return rental;
  },

  async create(agencyId: string, input: CreateRentalInput, userId: string, ipAddress?: string) {
    const car = await CarsService.getById(agencyId, input.carId);
    await ClientsService.getById(agencyId, input.clientId);

    // RENTED passes here on purpose (see BOOKABLE_CAR_STATUSES): whether the
    // car is actually free for *these* dates is the overlap check's job
    // below, which also blocks a same-day booking while it's still out.
    if (!(BOOKABLE_CAR_STATUSES as readonly string[]).includes(car.status)) {
      throw new AppError(
        409,
        'CAR_NOT_AVAILABLE',
        `Cette voiture n'est pas disponible actuellement (statut : ${car.status}).`,
      );
    }

    // A booking can't start in the past: as a reservation it would read as
    // "départ en retard" from the moment it's created, and the remise des
    // clés would then re-date it to today anyway. Today itself is fine.
    if (input.pickupDate.getTime() < agencyDay().getTime()) {
      throw new AppError(
        400,
        'PICKUP_DATE_IN_PAST',
        'La date de prise en charge ne peut pas être antérieure à aujourd’hui.',
      );
    }

    // A handover (activation) means the client leaves with the keys right
    // now, so it's only meaningful for a rental starting today. Without
    // this guard, a future-dated "Location immédiate" was created straight
    // as ACTIVE with its car flipped to RENTED weeks ahead of time — showing
    // as "en cours" before its date and hiding the car from every other
    // booking in the meantime. A future pickup must go through the
    // RESERVED → activate() path instead.
    if (input.activation && input.pickupDate.getTime() !== agencyDay().getTime()) {
      throw new AppError(
        400,
        'IMMEDIATE_PICKUP_NOT_TODAY',
        "Une location immédiate doit commencer aujourd'hui. Pour une autre date, utilisez la réservation à l'avance.",
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
      throw new AppError(
        409,
        'CAR_NOT_AVAILABLE',
        'Cette voiture est déjà réservée pour ces dates.',
      );
    }

    // After the availability checks: for a car that isn't free anyway,
    // "unavailable" is the useful answer, not its odometer.
    if (input.activation) {
      assertMileageNotBelowOdometer(input.activation.mileageAtPickup, car.mileage);
    }

    const setting = await prisma.setting.findFirst({ where: { agencyId } });
    const depositAmount = input.depositAmount ?? Number(setting?.defaultDepositAmount ?? 0);
    const nights = calculateNights(input.pickupDate, input.plannedReturnDate);
    // A negotiated rate applies to this rental only; the car's own
    // catalogue rate is never modified, just recorded alongside it.
    const dailyRate = input.dailyRate ?? Number(car.dailyRate);
    const totalAmount = dailyRate * nights;

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
            throw new AppError(
              409,
              'CAR_NOT_AVAILABLE',
              'Cette voiture est déjà réservée pour ces dates.',
            );
          }

          const rental = await RentalsRepository.create(
            {
              rentalNumber,
              agencyId,
              carId: input.carId,
              clientId: input.clientId,
              pickupDate: input.pickupDate,
              plannedReturnDate: input.plannedReturnDate,
              dailyRate,
              catalogDailyRate: car.dailyRate,
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
              agencyId,
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

            // The pickup reading is now the car's current odometer.
            const carActivated = await CarsRepository.updateStatusGuarded(
              input.carId,
              ['AVAILABLE'],
              { status: 'RENTED', mileage: input.activation.mileageAtPickup },
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
          return RentalsRepository.findById(agencyId, rental.id, undefined, tx);
        }, LIFECYCLE_ISOLATION);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === UNIQUE_CONSTRAINT_VIOLATION
        ) {
          continue;
        }
        // Postgres SERIALIZABLE aborts the losing side of a genuine race
        // instead of letting both transactions commit — without this, that
        // surfaces as a raw 500 instead of the same friendly conflict
        // message the non-racing path already throws above.
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === WRITE_CONFLICT) {
          throw new AppError(
            409,
            'CAR_NOT_AVAILABLE',
            'Cette voiture vient d’être réservée, veuillez réessayer.',
          );
        }
        throw err;
      }
    }

    throw new AppError(
      500,
      'RENTAL_NUMBER_GENERATION_FAILED',
      'Impossible de générer un numéro de location.',
    );
  },

  async activate(
    agencyId: string,
    id: string,
    input: ActivateRentalInput,
    userId: string,
    ipAddress?: string,
  ) {
    const rental = await RentalsService.getById(agencyId, id);

    if (rental.status !== 'RESERVED') {
      throw new AppError(
        409,
        'INVALID_RENTAL_STATE',
        `Impossible d'activer une location au statut ${rental.status}.`,
      );
    }

    assertMileageNotBelowOdometer(input.mileageAtPickup, rental.car.mileage);

    // Activation always records the moment the keys actually change hands,
    // not whatever pickupDate was originally booked — recalculated
    // unconditionally, not just for a late pickup. An early activation (the
    // client showing up well before their scheduled date) is allowed, not
    // blocked outright: it's only actually a problem if the car is already
    // committed elsewhere for that widened window (checked just below). An
    // on-time activation lands on the same night count either way
    // (calculateNights rounds up), so this never double-charges or
    // undercharges the common case.
    // Nights counted from today's calendar day, not the exact instant: from
    // `now` itself, a handover between 00:00 and 01:00 (Tunis) on the
    // scheduled day — still the previous day in UTC — billed one night more
    // than an on-time activation any other hour of that same day.
    const now = new Date();
    const totalAmount = calculateNights(agencyDay(now), rental.plannedReturnDate) * Number(rental.dailyRate);

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
          throw new AppError(
            409,
            'CAR_NOT_AVAILABLE',
            'Cette voiture est déjà en location sur cette période.',
          );
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

      // The pickup reading is now the car's current odometer.
      const carGuarded = await CarsRepository.updateStatusGuarded(
        rental.carId,
        ['AVAILABLE'],
        { status: 'RENTED', mileage: input.mileageAtPickup },
        tx,
      );
      if (!carGuarded) {
        throw new AppError(
          409,
          'CAR_NOT_AVAILABLE',
          "Cette voiture n'est pas disponible pour la prise en charge actuellement.",
        );
      }

      const updated = await RentalsRepository.findById(agencyId, id, undefined, tx);
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

  async returnRental(
    agencyId: string,
    id: string,
    input: ReturnRentalInput,
    userId: string,
    ipAddress?: string,
  ) {
    const rental = await RentalsService.getById(agencyId, id);

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
    // itself is 0 days late, not 1: comparing the exact instant rounded any
    // moment past midnight of that day up to a full day late, charging a fee
    // for a return that was actually on time. actualReturnDate (a real
    // timestamp) is truncated to its Tunis calendar day (agencyDay) — a UTC
    // truncation billed a return made between 00:00 and 01:00 one day short.
    // plannedReturnDate is already a calendar day.
    const lateDays = Math.max(
      0,
      Math.floor(
        (agencyDay(actualReturnDate).getTime() - rental.plannedReturnDate.getTime()) / MS_PER_DAY,
      ),
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
          agencyId,
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
          agencyId,
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

      const updated = await RentalsRepository.findById(agencyId, id, undefined, tx);
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

  async extend(
    agencyId: string,
    id: string,
    input: ExtendRentalInput,
    userId: string,
    ipAddress?: string,
  ) {
    const rental = await RentalsService.getById(agencyId, id);

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
        throw new AppError(
          409,
          'CAR_NOT_AVAILABLE',
          'Cette voiture est déjà réservée pour ces dates.',
        );
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
        agencyId,
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

      const updated = await RentalsRepository.findById(agencyId, id, undefined, tx);
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

  async cancel(
    agencyId: string,
    id: string,
    input: CancelRentalInput,
    userId: string,
    ipAddress?: string,
  ) {
    const rental = await RentalsService.getById(agencyId, id);

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

      const updated = await RentalsRepository.findById(agencyId, id, undefined, tx);
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
