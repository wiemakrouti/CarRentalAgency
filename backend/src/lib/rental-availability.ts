import type { Prisma } from '@prisma/client';
import { endOfDayExclusive, agencyDay } from './date-utils.js';

export const OVERLAPPING_RENTAL_STATUSES = ['RESERVED', 'ACTIVE'] as const;

// Car statuses a new booking can still be made for. RENTED is bookable: a
// car out with a client this week can be reserved for next week — the
// date-overlap check below is what actually decides whether the requested
// range is free. MAINTENANCE/OUT_OF_SERVICE are out of rotation until an
// admin puts them back, so they're never offered.
export const BOOKABLE_CAR_STATUSES = ['AVAILABLE', 'RENTED'] as const;

// Two half-open date ranges [pickupDate, returnDate) overlap exactly when
// each starts before the other ends. Shared by Cars' /cars/available check
// and Rentals' creation validation so "available" means the same thing in
// both places — never redefine this condition locally in either module.
//
// One exception to the plain range test: an ACTIVE rental past its
// plannedReturnDate (car not brought back yet) still physically holds the
// car through today, whatever its planned date says — so it blocks any
// requested range starting today or earlier. Ranges starting tomorrow or
// later stay bookable; the overdue return is surfaced by the reminders.
export function overlappingRentalsFilter(params: {
  pickupDate: Date;
  returnDate: Date;
  excludeRentalId?: string;
}): Prisma.RentalWhereInput {
  const startsBeforeTomorrow = params.pickupDate < endOfDayExclusive(agencyDay());

  return {
    pickupDate: { lt: params.returnDate },
    OR: [
      {
        status: { in: [...OVERLAPPING_RENTAL_STATUSES] },
        plannedReturnDate: { gt: params.pickupDate },
      },
      ...(startsBeforeTomorrow ? [{ status: 'ACTIVE' as const }] : []),
    ],
    ...(params.excludeRentalId ? { id: { not: params.excludeRentalId } } : {}),
  };
}
