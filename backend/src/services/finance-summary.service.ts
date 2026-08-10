import {
  EXPENSE_CATEGORIES,
  PAYMENT_TYPES,
  type ExpenseCategory,
  type FinanceSummaryQuery,
  type PaymentType,
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

    const [revenueByTypeRows, pendingTotal, expensesByCategoryRows, expensesTotal] = await Promise.all([
      PaymentsRepository.sumByTypeForStatus('COMPLETED', range),
      PaymentsRepository.sumForStatus('PENDING', range),
      ExpensesRepository.sumByCategory(range),
      ExpensesRepository.sumTotal(range),
    ]);

    const revenueByType = zeroFill(
      PAYMENT_TYPES,
      revenueByTypeRows.map((row) => ({ type: row.type, amount: Number(row._sum.amount ?? 0) })),
      (row) => row.type as PaymentType,
    );
    const expensesByCategory = zeroFill(
      EXPENSE_CATEGORIES,
      expensesByCategoryRows.map((row) => ({ category: row.category, amount: Number(row._sum.amount ?? 0) })),
      (row) => row.category as ExpenseCategory,
    );

    const revenueTotal = Object.values<number>(revenueByType).reduce((sum, amount) => sum + amount, 0);
    const expensesTotalNumber = Number(expensesTotal);

    return {
      period: { from: query.from, to: query.to },
      revenue: { total: revenueTotal, byType: revenueByType },
      expenses: { total: expensesTotalNumber, byCategory: expensesByCategory },
      pendingTotal: Number(pendingTotal),
      net: revenueTotal - expensesTotalNumber,
    };
  },
};
