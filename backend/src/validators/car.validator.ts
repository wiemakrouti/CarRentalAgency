import { z } from 'zod';
import {
  CAR_CATEGORIES,
  CAR_STATUSES,
  FUEL_TYPES,
  TRANSMISSIONS,
  paginationQuerySchema,
  includeArchivedQuerySchema,
} from '@car-rental/shared';

export const carIdParamSchema = z.object({ id: z.string().uuid() });

export const carImageIdParamSchema = carIdParamSchema.extend({
  imageId: z.string().uuid(),
});

export const carListQuerySchema = paginationQuerySchema.merge(includeArchivedQuerySchema).extend({
  search: z.string().trim().min(1).optional(),
  category: z.enum(CAR_CATEGORIES).optional(),
  status: z.enum(CAR_STATUSES).optional(),
  transmission: z.enum(TRANSMISSIONS).optional(),
  fuelType: z.enum(FUEL_TYPES).optional(),
});

export type CarListQuery = z.infer<typeof carListQuerySchema>;

export const availableQuerySchema = z
  .object({
    pickupDate: z.coerce.date(),
    returnDate: z.coerce.date(),
  })
  .refine((data) => data.returnDate > data.pickupDate, {
    message: 'La date de retour doit être après la date de prise en charge.',
    path: ['returnDate'],
  });

export type AvailableQuery = z.infer<typeof availableQuerySchema>;
