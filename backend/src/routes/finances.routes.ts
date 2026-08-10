import { Router } from 'express';
import {
  createExpenseSchema,
  createPaymentSchema,
  financeSummaryQuerySchema,
  updateExpenseSchema,
  updatePaymentSchema,
} from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { uploadPaymentAttachment } from '../middleware/upload.js';
import { FinancesController } from '../controllers/finances.controller.js';
import {
  expenseIdParamSchema,
  expenseListQuerySchema,
  paymentAttachmentIdParamSchema,
  paymentIdParamSchema,
  paymentListQuerySchema,
} from '../validators/finance.validator.js';

export const financesRouter = Router();

financesRouter.use('/finances', authenticate, authorize('ADMIN'));

financesRouter.get(
  '/finances/summary',
  validate({ query: financeSummaryQuerySchema }),
  asyncHandler(FinancesController.getSummary),
);

// Payments
financesRouter.get(
  '/finances/payments',
  validate({ query: paymentListQuerySchema }),
  asyncHandler(FinancesController.listPayments),
);
financesRouter.post(
  '/finances/payments',
  validate({ body: createPaymentSchema }),
  asyncHandler(FinancesController.createPayment),
);
financesRouter.get(
  '/finances/payments/:id',
  validate({ params: paymentIdParamSchema }),
  asyncHandler(FinancesController.getPaymentById),
);
financesRouter.patch(
  '/finances/payments/:id',
  validate({ params: paymentIdParamSchema, body: updatePaymentSchema }),
  asyncHandler(FinancesController.updatePayment),
);
financesRouter.delete(
  '/finances/payments/:id',
  validate({ params: paymentIdParamSchema }),
  asyncHandler(FinancesController.archivePayment),
);
financesRouter.post(
  '/finances/payments/:id/restore',
  validate({ params: paymentIdParamSchema }),
  asyncHandler(FinancesController.restorePayment),
);
financesRouter.post(
  '/finances/payments/:id/attachments',
  validate({ params: paymentIdParamSchema }),
  uploadPaymentAttachment,
  asyncHandler(FinancesController.uploadPaymentAttachment),
);
financesRouter.delete(
  '/finances/payments/:id/attachments/:attachmentId',
  validate({ params: paymentAttachmentIdParamSchema }),
  asyncHandler(FinancesController.deletePaymentAttachment),
);

// Expenses
financesRouter.get(
  '/finances/expenses',
  validate({ query: expenseListQuerySchema }),
  asyncHandler(FinancesController.listExpenses),
);
financesRouter.post(
  '/finances/expenses',
  validate({ body: createExpenseSchema }),
  asyncHandler(FinancesController.createExpense),
);
financesRouter.get(
  '/finances/expenses/:id',
  validate({ params: expenseIdParamSchema }),
  asyncHandler(FinancesController.getExpenseById),
);
financesRouter.patch(
  '/finances/expenses/:id',
  validate({ params: expenseIdParamSchema, body: updateExpenseSchema }),
  asyncHandler(FinancesController.updateExpense),
);
financesRouter.delete(
  '/finances/expenses/:id',
  validate({ params: expenseIdParamSchema }),
  asyncHandler(FinancesController.archiveExpense),
);
financesRouter.post(
  '/finances/expenses/:id/restore',
  validate({ params: expenseIdParamSchema }),
  asyncHandler(FinancesController.restoreExpense),
);
