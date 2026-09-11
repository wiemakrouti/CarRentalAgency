import { z } from 'zod';
import {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYMENT_TYPES,
  includeArchivedQuerySchema,
  paginationQuerySchema,
} from '@car-rental/shared';

export const paymentIdParamSchema = z.object({ id: z.string().uuid() });

export const paymentAttachmentIdParamSchema = paymentIdParamSchema.extend({
  attachmentId: z.string().uuid(),
});

export const paymentListQuerySchema = paginationQuerySchema.merge(includeArchivedQuerySchema).extend({
  rentalId: z.string().uuid().optional(),
  type: z.enum(PAYMENT_TYPES).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  search: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export const expenseIdParamSchema = z.object({ id: z.string().uuid() });

export const expenseListQuerySchema = paginationQuerySchema.merge(includeArchivedQuerySchema).extend({
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  carId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
  // The "Autre" sub-type — matched against `description`, mirrors the
  // expense form's own dropdown (only meaningful with category=OTHER).
  subcategory: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;

// `status` is derived (Rental.depositReturned), not a Payment column — no
// shared enum for it, just the two states the "Cautions" ledger cares about.
export const depositListQuerySchema = paginationQuerySchema.extend({
  status: z.enum(['OUTSTANDING', 'REFUNDED']).optional(),
  search: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type DepositListQuery = z.infer<typeof depositListQuerySchema>;
