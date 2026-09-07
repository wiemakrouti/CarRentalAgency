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
});

export type RentalListQuery = z.infer<typeof rentalListQuerySchema>;
