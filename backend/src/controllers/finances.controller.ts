import type { Request, Response } from 'express';
import type { CreateExpenseInput, CreatePaymentInput, UpdateExpenseInput, UpdatePaymentInput } from '@car-rental/shared';
import { AppError } from '../utils/app-error.js';
import { PaymentsService } from '../services/payments.service.js';
import { ExpensesService } from '../services/expenses.service.js';
import { FinanceSummaryService } from '../services/finance-summary.service.js';
import type { ExpenseListQuery, PaymentListQuery } from '../validators/finance.validator.js';
import type { FinanceSummaryQuery } from '@car-rental/shared';

export const FinancesController = {
  async listPayments(req: Request, res: Response) {
    const query = req.query as unknown as PaymentListQuery;
    const result = await PaymentsService.list(query);
    res.status(200).json({
      success: true,
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  },

  async getPaymentById(req: Request, res: Response) {
    const payment = await PaymentsService.getById(req.params.id!);
    res.status(200).json({ success: true, data: payment });
  },

  async createPayment(req: Request, res: Response) {
    const input = req.body as CreatePaymentInput;
    const payment = await PaymentsService.create(input, req.user!.id, req.ip);
    res.status(201).json({ success: true, data: payment });
  },

  async updatePayment(req: Request, res: Response) {
    const input = req.body as UpdatePaymentInput;
    const payment = await PaymentsService.update(req.params.id!, input, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: payment });
  },

  async archivePayment(req: Request, res: Response) {
    const payment = await PaymentsService.archive(req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: payment });
  },

  async restorePayment(req: Request, res: Response) {
    const payment = await PaymentsService.restore(req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: payment });
  },

  async uploadPaymentAttachment(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, 'ATTACHMENT_REQUIRED', 'Un fichier est requis.');
    }
    const attachment = await PaymentsService.addAttachment(req.params.id!, req.file, req.user!.id, req.ip);
    res.status(201).json({ success: true, data: attachment });
  },

  async deletePaymentAttachment(req: Request, res: Response) {
    await PaymentsService.removeAttachment(req.params.id!, req.params.attachmentId!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: { deleted: true } });
  },

  async listExpenses(req: Request, res: Response) {
    const query = req.query as unknown as ExpenseListQuery;
    const result = await ExpensesService.list(query);
    res.status(200).json({
      success: true,
      data: result.items,
      meta: { page: result.page, pageSize: result.pageSize, total: result.total },
    });
  },

  async getExpenseById(req: Request, res: Response) {
    const expense = await ExpensesService.getById(req.params.id!);
    res.status(200).json({ success: true, data: expense });
  },

  async createExpense(req: Request, res: Response) {
    const input = req.body as CreateExpenseInput;
    const expense = await ExpensesService.create(input, req.user!.id, req.ip);
    res.status(201).json({ success: true, data: expense });
  },

  async updateExpense(req: Request, res: Response) {
    const input = req.body as UpdateExpenseInput;
    const expense = await ExpensesService.update(req.params.id!, input, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: expense });
  },

  async archiveExpense(req: Request, res: Response) {
    const expense = await ExpensesService.archive(req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: expense });
  },

  async restoreExpense(req: Request, res: Response) {
    const expense = await ExpensesService.restore(req.params.id!, req.user!.id, req.ip);
    res.status(200).json({ success: true, data: expense });
  },

  async getSummary(req: Request, res: Response) {
    const query = req.query as unknown as FinanceSummaryQuery;
    const summary = await FinanceSummaryService.getSummary(query);
    res.status(200).json({ success: true, data: summary });
  },
};
