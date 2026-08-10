import { z } from 'zod';
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, PAYMENT_STATUSES, PAYMENT_TYPES } from '../enums.js';

// Manual payments are always recorded as already-received money — `status`
// isn't client-settable on create (see PATCH below for correcting/settling
// the PENDING rows Rentals auto-generates for late fees/damage/extensions).
export const createPaymentSchema = z.object({
  rentalId: z.string().uuid(),
  amount: z.coerce.number().positive('Le montant doit être positif'),
  method: z.enum(PAYMENT_METHODS),
  type: z.enum(PAYMENT_TYPES),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

// `type` is deliberately not editable here: it's what a payment *is*
// (e.g. DEPOSIT_REFUND drives the Rental.depositReturned sync at creation
// time), not a correctable detail. Correcting/settling covers amount,
// method, status and paidAt.
export const updatePaymentSchema = z.object({
  amount: z.coerce.number().positive('Le montant doit être positif').optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  status: z.enum(PAYMENT_STATUSES).optional(),
  paidAt: z.coerce.date().nullable().optional(),
  notes: z.string().trim().min(1).nullable().optional(),
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive('Le montant doit être positif'),
  carId: z.string().uuid().nullable().optional(),
  description: z.string().trim().min(1, 'La description est requise'),
  date: z.coerce.date(),
  receiptUrl: z.string().trim().url("L'URL du justificatif est invalide").nullable().optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema.partial();

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const financeSummaryQuerySchema = z
  .object({
    from: z.coerce.date(),
    to: z.coerce.date(),
  })
  .refine((data) => data.to >= data.from, {
    message: 'La date de fin doit être postérieure ou égale à la date de début.',
    path: ['to'],
  });

export type FinanceSummaryQuery = z.infer<typeof financeSummaryQuerySchema>;
