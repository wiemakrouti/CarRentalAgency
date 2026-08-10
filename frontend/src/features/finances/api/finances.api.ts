import type {
  CreateExpenseInput,
  CreatePaymentInput,
  ExpenseCategory,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
  UpdateExpenseInput,
  UpdatePaymentInput,
} from '@car-rental/shared';
import type { Car } from '@/features/cars/api/cars.api';
import type { Client } from '@/features/clients/api/clients.api';
import { apiClient } from '@/lib/api-client';
import { buildQueryString } from '@/lib/query-string';

export type PaymentAttachment = {
  id: string;
  paymentId: string;
  url: string;
  publicId: string;
  createdAt: string;
};

// `rental` is only populated by the Finances payments list/detail endpoints
// (a rental's own nested `payments[]` already sits under that rental, so
// repeating it there would just be duplicate payload — see
// backend/src/repositories/payments.repository.ts).
export type Payment = {
  id: string;
  rentalId: string;
  amount: string;
  method: PaymentMethod;
  type: PaymentType;
  status: PaymentStatus;
  paidAt: string | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  attachments: PaymentAttachment[];
  rental?: { id: string; rentalNumber: string; car: Car; client: Client };
};

export type Expense = {
  id: string;
  category: ExpenseCategory;
  amount: string;
  carId: string | null;
  car: Car | null;
  description: string;
  date: string;
  receiptUrl: string | null;
  deletedAt: string | null;
  createdAt: string;
};

export type FinanceSummary = {
  period: { from: string; to: string };
  revenue: { total: number; byType: Record<PaymentType, number> };
  expenses: { total: number; byCategory: Record<ExpenseCategory, number> };
  pendingTotal: number;
  net: number;
};

export type PaymentListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  rentalId?: string;
  type?: string;
  status?: string;
  method?: string;
  includeArchived?: boolean;
};

export type ExpenseListParams = {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  carId?: string;
  from?: string;
  to?: string;
  includeArchived?: boolean;
};

export const financesApi = {
  listPayments: (params: PaymentListParams) =>
    apiClient.getPaginated<Payment>(`/finances/payments${buildQueryString(params)}`),
  getPaymentById: (id: string) => apiClient.get<Payment>(`/finances/payments/${id}`),
  createPayment: (input: CreatePaymentInput) => apiClient.post<Payment>('/finances/payments', input),
  updatePayment: (id: string, input: UpdatePaymentInput) =>
    apiClient.patch<Payment>(`/finances/payments/${id}`, input),
  archivePayment: (id: string) => apiClient.delete<Payment>(`/finances/payments/${id}`),
  restorePayment: (id: string) => apiClient.post<Payment>(`/finances/payments/${id}/restore`),
  uploadPaymentAttachment: (paymentId: string, file: File) => {
    const formData = new FormData();
    formData.append('attachment', file);
    return apiClient.postForm<PaymentAttachment>(`/finances/payments/${paymentId}/attachments`, formData);
  },
  deletePaymentAttachment: (paymentId: string, attachmentId: string) =>
    apiClient.delete<{ deleted: boolean }>(`/finances/payments/${paymentId}/attachments/${attachmentId}`),

  listExpenses: (params: ExpenseListParams) =>
    apiClient.getPaginated<Expense>(`/finances/expenses${buildQueryString(params)}`),
  getExpenseById: (id: string) => apiClient.get<Expense>(`/finances/expenses/${id}`),
  createExpense: (input: CreateExpenseInput) => apiClient.post<Expense>('/finances/expenses', input),
  updateExpense: (id: string, input: UpdateExpenseInput) =>
    apiClient.patch<Expense>(`/finances/expenses/${id}`, input),
  archiveExpense: (id: string) => apiClient.delete<Expense>(`/finances/expenses/${id}`),
  restoreExpense: (id: string) => apiClient.post<Expense>(`/finances/expenses/${id}/restore`),

  getSummary: (from: string, to: string) =>
    apiClient.get<FinanceSummary>(`/finances/summary${buildQueryString({ from, to })}`),
};
