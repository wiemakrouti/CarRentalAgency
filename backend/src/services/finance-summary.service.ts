import {
  EXPENSE_CATEGORIES,
  REVENUE_PAYMENT_TYPES,
  type ExpenseCategory,
  type FinanceSummaryQuery,
  type RevenuePaymentType,
} from '@car-rental/shared';
import { PaymentsRepository } from '../repositories/payments.repository.js';
import { ExpensesRepository } from '../repositories/expenses.repository.js';

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
  async getSummary(query: FinanceSummaryQuery) {
    const range = { from: query.from, to: query.to };

    const [revenueByTypeRows, pendingByTypeRows, expensesByCategoryRows, expensesTotal] = await Promise.all([
      PaymentsRepository.sumByTypeForStatus('COMPLETED', range),
      PaymentsRepository.sumByTypeForStatus('PENDING', range),
      ExpensesRepository.sumByCategory(range),
      ExpensesRepository.sumTotal(range),
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
        .map((row) => ({ type: row.type as RevenuePaymentType, amount: Number(row._sum.amount ?? 0) })),
      (row) => row.type,
    );
    const expensesByCategory = zeroFill(
      EXPENSE_CATEGORIES,
      expensesByCategoryRows.map((row) => ({ category: row.category, amount: Number(row._sum.amount ?? 0) })),
      (row) => row.category as ExpenseCategory,
    );

    const revenueTotal = Object.values<number>(revenueByType).reduce((sum, amount) => sum + amount, 0);
    const expensesTotalNumber = Number(expensesTotal);
    // Same exclusion for "Paiements en attente" — a deposit is never left
    // PENDING in practice (always recorded COMPLETED at collection), but
    // this keeps the definition consistent with "Revenus" either way.
    const pendingTotal = pendingByTypeRows
      .filter((row) => isRevenueType(row.type))
      .reduce((sum, row) => sum + Number(row._sum.amount ?? 0), 0);

    // Cautions, tracked separately from revenue — visible here rather than
    // silently dropped now that they no longer feed into "Revenus" above.
    const depositsCollected = revenueByTypeRows.find((row) => row.type === 'DEPOSIT');
    const depositsRefunded = revenueByTypeRows.find((row) => row.type === 'DEPOSIT_REFUND');

    return {
      period: { from: query.from, to: query.to },
      revenue: { total: revenueTotal, byType: revenueByType },
      deposits: {
        collected: Number(depositsCollected?._sum.amount ?? 0),
        refunded: Number(depositsRefunded?._sum.amount ?? 0),
      },
      expenses: { total: expensesTotalNumber, byCategory: expensesByCategory },
      pendingTotal,
      net: revenueTotal - expensesTotalNumber,
    };
  },
};
