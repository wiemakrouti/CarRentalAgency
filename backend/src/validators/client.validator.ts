import { z } from 'zod';
import { paginationQuerySchema } from '@car-rental/shared';

export const clientIdParamSchema = z.object({ id: z.string().uuid() });

export const clientDocumentIdParamSchema = clientIdParamSchema.extend({
  documentId: z.string().uuid(),
});

const CLIENT_SORT_FIELDS = ['lastName', 'city', 'createdAt', 'drivingLicenseExpiry'] as const;

// Computed the same way as the frontend's client-alerts.ts (30-day warning
// window) so a "Permis" filter matches what the badge on screen shows.
const LICENSE_STATUSES = ['expired', 'expiring', 'ok', 'not_set'] as const;

// No includeArchived here — Client has no soft-delete (see
// docs/architecture.md § Soft delete), unlike the modules still built on
// includeArchivedQuerySchema.
export const clientListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  licenseStatus: z.enum(LICENSE_STATUSES).optional(),
  sortBy: z.enum(CLIENT_SORT_FIELDS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ClientListQuery = z.infer<typeof clientListQuerySchema>;

// Same filters as the list, minus pagination — export always returns every
// matching row, not one page of it (mirrors carExportQuerySchema).
export const clientExportQuerySchema = clientListQuerySchema.omit({ page: true, pageSize: true });

export type ClientExportQuery = z.infer<typeof clientExportQuerySchema>;

export const clientCheckPhoneQuerySchema = z.object({
  phone: z.string().trim().min(1),
  excludeId: z.string().uuid().optional(),
});

export type ClientCheckPhoneQuery = z.infer<typeof clientCheckPhoneQuerySchema>;
