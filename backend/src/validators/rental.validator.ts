import { z } from 'zod';
import { includeArchivedQuerySchema, paginationQuerySchema, RENTAL_STATUSES } from '@car-rental/shared';

export const rentalIdParamSchema = z.object({ id: z.string().uuid() });

export const rentalListQuerySchema = paginationQuerySchema.merge(includeArchivedQuerySchema).extend({
  status: z.enum(RENTAL_STATUSES).optional(),
  carId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
});

export type RentalListQuery = z.infer<typeof rentalListQuerySchema>;
