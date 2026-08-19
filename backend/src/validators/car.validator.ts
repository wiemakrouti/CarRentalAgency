import { z } from 'zod';
import {
  CAR_CATEGORIES,
  CAR_STATUSES,
  FUEL_TYPES,
  MANUALLY_SETTABLE_CAR_STATUSES,
  TRANSMISSIONS,
  paginationQuerySchema,
} from '@car-rental/shared';

export const carIdParamSchema = z.object({ id: z.string().uuid() });

export const carImageIdParamSchema = carIdParamSchema.extend({
  imageId: z.string().uuid(),
});

const CAR_SORT_FIELDS = [
  'brand',
  'licensePlate',
  'category',
  'status',
  'dailyRate',
  'year',
  'mileage',
  'createdAt',
] as const;

export const carListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  category: z.enum(CAR_CATEGORIES).optional(),
  status: z.enum(CAR_STATUSES).optional(),
  transmission: z.enum(TRANSMISSIONS).optional(),
  fuelType: z.enum(FUEL_TYPES).optional(),
  minDailyRate: z.coerce.number().nonnegative().optional(),
  maxDailyRate: z.coerce.number().nonnegative().optional(),
  minYear: z.coerce.number().int().optional(),
  maxYear: z.coerce.number().int().optional(),
  minMileage: z.coerce.number().int().nonnegative().optional(),
  maxMileage: z.coerce.number().int().nonnegative().optional(),
  sortBy: z.enum(CAR_SORT_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type CarListQuery = z.infer<typeof carListQuerySchema>;

// Same filters as the list, minus pagination — export always returns every
// matching row, not one page of it.
export const carExportQuerySchema = carListQuerySchema.omit({ page: true, pageSize: true });

export type CarExportQuery = z.infer<typeof carExportQuerySchema>;

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

export const bulkCarIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Sélectionnez au moins une voiture.'),
});

export type BulkCarIdsInput = z.infer<typeof bulkCarIdsSchema>;

export const bulkCarStatusSchema = bulkCarIdsSchema.extend({
  status: z.enum(MANUALLY_SETTABLE_CAR_STATUSES),
});

export type BulkCarStatusInput = z.infer<typeof bulkCarStatusSchema>;
