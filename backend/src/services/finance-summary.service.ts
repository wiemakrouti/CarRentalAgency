import {
  EXPENSE_CATEGORIES,
  REVENUE_PAYMENT_TYPES,
  type ExpenseCategory,
  type FinanceSummaryQuery,
  type RevenuePaymentType,
} from '@car-rental/shared';
import { PaymentsRepository } from '../repositories/payments.repository.js';
import { ExpensesRepository } from '../repositories/expenses.repository.js';
import type { DepositListQuery } from '../validators/finance.validator.js';

// Zero-fills every known type/category (not just the ones with rows in
// range) so the frontend never has to special-case "no data yet" per key —
// a summary widget/table can always iterate the full, stable set.
function zeroFill<Key extends string, Row extends { amount: number }>(
  keys: readonly Key[],
  rows: Row[],
  keyOf: (row: Row) => Key,
): Record<Key, number> {
  const result = Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
  for (const row of rows) {
    result[keyOf(row)] = row.amount;
  }
  return result;
}

export const FinanceSummaryService = {
  async getSummary(agencyId: string, query: FinanceSummaryQuery) {
    const range = { from: query.from, to: query.to };

    const [
      revenueByTypeRows,
      pendingByTypeRows,
      expensesByCategoryRows,
      expensesTotal,
      depositFlows,
    ] = await Promise.all([
      PaymentsRepository.sumByTypeForStatus(agencyId, 'COMPLETED', range),
      PaymentsRepository.sumByTypeForStatus(agencyId, 'PENDING', range),
      ExpensesRepository.sumByCategory(agencyId, range),
      ExpensesRepository.sumTotal(agencyId, range),
      // All-time on purpose — the Résumé's Cautions card ignores `range`,
      // so this reads the whole history rather than the period.
      PaymentsRepository.sumDepositFlows(agencyId),
    ]);

    // DEPOSIT/DEPOSIT_REFUND are excluded from "Revenus" — a caution is a
    // refundable hold, not agency income (mirrors rental-balance.ts's own
    // identical exclusion on the per-rental balance). Left in, collecting
    // then fully refunding one would inflate revenue by 2x its amount, since
    // both legs are recorded as positive Payment rows.
    const isRevenueType = (type: string): type is RevenuePaymentType =>
      (REVENUE_PAYMENT_TYPES as readonly string[]).includes(type);

    const revenueByType = zeroFill(
      REVENUE_PAYMENT_TYPES,
      revenueByTypeRows
        .filter((row) => isRevenueType(row.type))
        .map((row) => ({
          type: row.type as RevenuePaymentType,
          amount: Number(row._sum.amount ?? 0),
        })),
      (row) => row.type,
    );
    const expensesByCategory = zeroFill(
      EXPENSE_CATEGORIES,
      expensesByCategoryRows.map((row) => ({
        category: row.category,
        amount: Number(row._sum.amount ?? 0),
      })),
      (row) => row.category as ExpenseCategory,
    );

    const revenueTotal = Object.values<number>(revenueByType).reduce(
      (sum, amount) => sum + amount,
      0,
    );
    const expensesTotalNumber = Number(expensesTotal);
    // Same exclusion for "Paiements en attente" — a deposit is never left
    // PENDING in practice (always recorded COMPLETED at collection), but
    // this keeps the definition consistent with "Revenus" either way.
    const pendingTotal = pendingByTypeRows
      .filter((row) => isRevenueType(row.type))
      .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);

    return {
      period: { from: query.from, to: query.to },
      revenue: { total: revenueTotal, byType: revenueByType },
      // All-time (see depositFlows above) — tracked separately from revenue
      // since a caution is a refundable hold, not agency income.
      deposits: depositFlows,
      expenses: { total: expensesTotalNumber, byCategory: expensesByCategory },
      pendingTotal,
      net: revenueTotal - expensesTotalNumber,
    };
  },

  // "Cautions" tab: a page of the ledger, one row per rental rather than per
  // payment — a rental could in principle have more than one COMPLETED
  // DEPOSIT row (e.g. a corrected amount), and depositReturned is a single
  // flag on the rental, not on each payment, so the collected amount is
  // their sum. Covers every caution ever collected, refunded or not —
  // `refundedAt` is null for the ones still outstanding.
  async listDeposits(agencyId: string, query: DepositListQuery) {
    const { items: payments, total } = await PaymentsRepository.findDepositsPage(agencyId, query);

    const byRental = new Map<
      string,
      Omit<(typeof payments)[number], 'amount'> & { amount: number }
    >();
    for (const payment of payments) {
      const existing = byRental.get(payment.rentalId);
      if (existing) {
        existing.amount += Number(payment.amount);
      } else {
        byRental.set(payment.rentalId, { ...payment, amount: Number(payment.amount) });
      }
    }

    const refunds = await PaymentsRepository.findDepositRefunds(
      agencyId,
      Array.from(byRental.keys()),
    );
    const refundedAtByRental = new Map(refunds.map((refund) => [refund.rentalId, refund.paidAt]));

    const items = Array.from(byRental.values()).map((payment) => ({
      rentalId: payment.rentalId,
      rentalNumber: payment.rental.rentalNumber,
      car: { brand: payment.rental.car.brand, model: payment.rental.car.model },
      client: {
        firstName: payment.rental.client.firstName,
        lastName: payment.rental.client.lastName,
      },
      amount: payment.amount,
      collectedAt: payment.paidAt,
      refundedAt: refundedAtByRental.get(payment.rentalId) ?? null,
    }));

    return { items, total, page: query.page, pageSize: query.pageSize };
  },
};
