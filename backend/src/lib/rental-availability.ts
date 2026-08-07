import type { Prisma } from '@prisma/client';

export const OVERLAPPING_RENTAL_STATUSES = ['RESERVED', 'ACTIVE'] as const;

// Two half-open date ranges [pickupDate, returnDate) overlap exactly when
// each starts before the other ends. Shared by Cars' /cars/available check
// and Rentals' creation validation so "available" means the same thing in
// both places — never redefine this condition locally in either module.
export function overlappingRentalsFilter(params: {
  pickupDate: Date;
  returnDate: Date;
}): Prisma.RentalWhereInput {
  return {
    status: { in: [...OVERLAPPING_RENTAL_STATUSES] },
    pickupDate: { lt: params.returnDate },
    plannedReturnDate: { gt: params.pickupDate },
  };
}
