import { z } from 'zod';
import { booleanQueryParam, includeArchivedQuerySchema, paginationQuerySchema, RENTAL_STATUSES } from '@car-rental/shared';

export const rentalIdParamSchema = z.object({ id: z.string().uuid() });

export const rentalListQuerySchema = paginationQuerySchema.merge(includeArchivedQuerySchema).extend({
  status: z.enum(RENTAL_STATUSES).optional(),
  carId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
  // Narrows RESERVED further than `status` alone can: "pickup overdue"
  // (client never showed up) isn't its own RentalStatus — it's RESERVED +
  // pickupDate in the past, the same condition RemindersService already
  // uses for RENTAL_PICKUP_OVERDUE and RentalsRepository.getSummaryCounts
  // uses for the KPI header's "Départs en retard" tile. Takes priority over
  // `status` in buildWhere when present, so the KPI cards can link here
  // without also having to agree on a matching `status` value.
  pickupOverdue: booleanQueryParam(),
  // Backs the Dashboard's status-pipeline gauge — one count-only /rentals
  // call per status, scoped to a pickupDate window (e.g. month-to-date).
  // Independent of pickupOverdue/status:'OVERDUE' above, which own
  // pickupDate for their own narrower purpose — combining both isn't a
  // real caller need and buildWhere merges them onto the same field rather
  // than guarding against it.
  pickupFrom: z.coerce.date().optional(),
  pickupTo: z.coerce.date().optional(),
});

export type RentalListQuery = z.infer<typeof rentalListQuerySchema>;

// The dashboard's fleet planning shows at most a month at a time — a little
// slack on top for the month view's leading/trailing days.
const MAX_PLANNING_RANGE_DAYS = 62;

// `from`/`to` are date-only strings, coerced the same way
// financeSummaryQuerySchema does for the identical reason (see its comment).
function dateRangeQuerySchema(maxDays: number) {
  return z
    .object({
      from: z.coerce.date(),
      to: z.coerce.date(),
    })
    .refine((data) => data.to >= data.from, {
      message: 'La date de fin doit être postérieure ou égale à la date de début.',
      path: ['to'],
    })
    .refine((data) => data.to.getTime() - data.from.getTime() <= maxDays * 24 * 60 * 60 * 1000, {
      message: `La période ne peut pas dépasser ${maxDays} jours.`,
      path: ['to'],
    });
}

// Backs the Dashboard's fleet planning (RentalsService.getPlanning).
export const rentalPlanningQuerySchema = dateRangeQuerySchema(MAX_PLANNING_RANGE_DAYS);

export type RentalPlanningQuery = z.infer<typeof rentalPlanningQuerySchema>;
