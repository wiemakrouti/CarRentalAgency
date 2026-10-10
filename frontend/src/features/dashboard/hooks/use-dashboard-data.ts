import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { financesApi, type FinanceSummary } from '@/features/finances/api/finances.api';
import { financeSummaryKeys } from '@/features/finances/api/finances.keys';
import { useToCollectRentalsQuery } from '@/features/rentals/hooks/use-rentals';
import { toDateParam } from '@/lib/date-range';

const MONTH_LABELS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// The same day-of-month as `date`, `monthsAgo` months earlier — clamped to
// that month's own last day (e.g. the 31st one month before a 30-day month
// becomes the 30th) so a "same point in the month" comparison anchored near
// the end of a long month never overflows into the month after.
function sameDayMonthsAgo(date: Date, monthsAgo: number): Date {
  const targetMonthStart = new Date(date.getFullYear(), date.getMonth() - monthsAgo, 1);
  const lastDayOfTargetMonth = endOfMonth(targetMonthStart).getDate();
  return new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth(),
    Math.min(date.getDate(), lastDayOfTargetMonth),
  );
}

function useFinanceSummaryQueries(ranges: { from: string; to: string }[]): UseQueryResult<FinanceSummary>[] {
  return useQueries({
    queries: ranges.map(({ from, to }) => ({
      queryKey: financeSummaryKeys.range(from, to),
      queryFn: () => financesApi.getSummary(from, to),
    })),
  });
}

// Consolidates every data source the Dashboard's Finances section needs into
// one hook, so the page component itself stays presentation-only (per the
// project's UI/business-logic separation rule) — it never talks to an API
// client directly. The fleet planning loads its own data.
export function useDashboardData() {
  const now = new Date();

  const toCollectQuery = useToCollectRentalsQuery();

  // Month-to-date revenue vs. the same number of days last month — a fair
  // "progress so far" comparison. Comparing against a full prior month
  // instead would always read as a big drop in the first days of a new one.
  const currentPeriod = { from: toDateParam(startOfMonth(now)), to: toDateParam(now) };
  const previousPeriod = {
    from: toDateParam(sameDayMonthsAgo(startOfMonth(now), 1)),
    to: toDateParam(sameDayMonthsAgo(now, 1)),
  };
  // Two fixed, individually-named queries (not the useQueries helper below,
  // which returns a plain array) — keeps each one's .data directly typed
  // instead of possibly-undefined array access.
  const currentRevenueQuery = useQuery({
    queryKey: financeSummaryKeys.range(currentPeriod.from, currentPeriod.to),
    queryFn: () => financesApi.getSummary(currentPeriod.from, currentPeriod.to),
  });
  const previousRevenueQuery = useQuery({
    queryKey: financeSummaryKeys.range(previousPeriod.from, previousPeriod.to),
    queryFn: () => financesApi.getSummary(previousPeriod.from, previousPeriod.to),
  });

  // Six calendar months ending with the current one (month-to-date) — the
  // chart's own trend line, independent of the like-for-like pair above.
  const monthRanges = Array.from({ length: 6 }, (_, i) => {
    const monthsAgo = 5 - i;
    const monthStart = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const monthEnd = monthsAgo === 0 ? now : endOfMonth(monthStart);
    // Non-null: getMonth() always returns 0-11 and MONTH_LABELS has exactly
    // 12 entries — guaranteed in range, just not something noUncheckedIndexedAccess can see.
    return { label: MONTH_LABELS[monthStart.getMonth()]!, from: toDateParam(monthStart), to: toDateParam(monthEnd) };
  });
  const monthlyRevenueQueries = useFinanceSummaryQueries(monthRanges);

  const allQueries: UseQueryResult<unknown>[] = [
    toCollectQuery,
    currentRevenueQuery,
    previousRevenueQuery,
    ...monthlyRevenueQueries,
  ];
  const isLoading = allQueries.some((q) => q.isLoading);
  const isError = allQueries.some((q) => q.isError);

  const previousRevenue = previousRevenueQuery.data?.revenue.total ?? 0;
  const currentRevenue = currentRevenueQuery.data?.revenue.total ?? 0;
  const previousExpenses = previousRevenueQuery.data?.expenses.total ?? 0;
  const currentExpenses = currentRevenueQuery.data?.expenses.total ?? 0;
  const previousProfit = previousRevenue - previousExpenses;
  const currentProfit = currentRevenue - currentExpenses;
  // No fair baseline (e.g. the agency's first month ever, or a prior period
  // that broke exactly even) means no trend — shown as an absence, never a
  // fabricated percentage. Divides by |previousProfit|, not previousProfit —
  // a negative prior-month result would otherwise flip the percentage's
  // sign relative to the actual direction of change (mirrors
  // finance-summary-tab.tsx's own computeTrend for the same reason).
  const monthProfitTrend =
    previousProfit !== 0 ? ((currentProfit - previousProfit) / Math.abs(previousProfit)) * 100 : null;

  // Both sides of the Revenus vs Dépenses chart come from the same
  // per-month FinanceSummary already fetched above for the revenue trend.
  const monthlyFinance = monthRanges.map((range, i) => ({
    month: range.label,
    revenue: monthlyRevenueQueries[i]?.data?.revenue.total ?? 0,
    expenses: monthlyRevenueQueries[i]?.data?.expenses.total ?? 0,
  }));

  function refetch() {
    allQueries.forEach((q) => q.refetch());
  }

  return {
    isLoading,
    isError,
    refetch,
    monthRevenue: currentRevenue,
    monthProfit: currentProfit,
    monthProfitTrend,
    monthlyFinance,
    toCollect: toCollectQuery.data ?? { rentals: [], billedAmount: 0, collectedAmount: 0 },
  };
}
