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
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;

export const expenseIdParamSchema = z.object({ id: z.string().uuid() });

export const expenseListQuerySchema = paginationQuerySchema.merge(includeArchivedQuerySchema).extend({
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  carId: z.string().uuid().optional(),
  search: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
