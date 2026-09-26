import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { carsApi } from '@/features/cars/api/cars.api';
import { carKeys } from '@/features/cars/api/cars.keys';
import { clientsApi } from '@/features/clients/api/clients.api';
import { clientKeys } from '@/features/clients/api/clients.keys';
import { financesApi, type FinanceSummary } from '@/features/finances/api/finances.api';
import { financeSummaryKeys } from '@/features/finances/api/finances.keys';
import { useRentalOccupancyQuery, useRentalSummaryQuery } from '@/features/rentals/hooks/use-rentals';

const MONTH_LABELS = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

// Only the single row list endpoints need — accurate `meta.total` costs the
// same one extra Prisma count() query however small `items` is, and a
// pageSize of 1 keeps the payload itself negligible.
const COUNT_ONLY = { page: 1, pageSize: 1 } as const;

// Occupancy heatmap window — 90 days ending today (inclusive), matching the
// "90 derniers jours" the widget itself is labeled with.
const OCCUPANCY_WINDOW_DAYS = 90;

// Local getters, not `toISOString()` — the Date objects built below (e.g.
// `startOfMonth`) are local midnight, and `toISOString()` converts to UTC
// first: in any timezone ahead of UTC that silently shifts "the 1st" back
// onto the last day of the previous month (same bug class as this session's
// backend/frontend rental late-day fixes — see date-range-filter.tsx).
function toDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

// Consolidates every data source the Dashboard needs into one hook, so the
// page component itself stays presentation-only (per the project's UI/
// business-logic separation rule) — it never talks to an API client
// directly.
export function useDashboardData() {
  const now = new Date();

  const rentalSummaryQuery = useRentalSummaryQuery();

  const totalCarsQuery = useQuery({
    queryKey: carKeys.list(COUNT_ONLY),
    queryFn: () => carsApi.list(COUNT_ONLY),
  });
  const availableCarsQuery = useQuery({
    queryKey: carKeys.list({ ...COUNT_ONLY, status: 'AVAILABLE' }),
    queryFn: () => carsApi.list({ ...COUNT_ONLY, status: 'AVAILABLE' }),
  });
  // Subtracted from totalCarsQuery below rather than filtered server-side
  // (the list endpoint only supports one status to match, not "any but
  // this one") — a sold/retired car is gone for good, so it should never
  // count toward "flotte totale" or dilute the occupancy heatmap's
  // denominator, both of which assume every counted car can still be
  // rented.
  const outOfServiceCarsQuery = useQuery({
    queryKey: carKeys.list({ ...COUNT_ONLY, status: 'OUT_OF_SERVICE' }),
    queryFn: () => carsApi.list({ ...COUNT_ONLY, status: 'OUT_OF_SERVICE' }),
  });
  const totalClientsQuery = useQuery({
    queryKey: clientKeys.list(COUNT_ONLY),
    queryFn: () => clientsApi.list(COUNT_ONLY),
  });

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

  // "+X ce mois-ci" under the Clients enregistrés KPI — same month-to-date
  // window as the revenue/profit figures above.
  const newClientsParams = { ...COUNT_ONLY, createdFrom: currentPeriod.from, createdTo: currentPeriod.to };
  const newClientsQuery = useQuery({
    queryKey: clientKeys.list(newClientsParams),
    queryFn: () => clientsApi.list(newClientsParams),
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

  const occupancyFrom = new Date(now);
  occupancyFrom.setDate(occupancyFrom.getDate() - (OCCUPANCY_WINDOW_DAYS - 1));
  const occupancyQuery = useRentalOccupancyQuery(toDateParam(occupancyFrom), toDateParam(now));

  const allQueries: UseQueryResult<unknown>[] = [
    rentalSummaryQuery,
    totalCarsQuery,
    availableCarsQuery,
    outOfServiceCarsQuery,
    totalClientsQuery,
    currentRevenueQuery,
    previousRevenueQuery,
    newClientsQuery,
    occupancyQuery,
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
  // per-month FinanceSummary already fetched above for the revenue trend —
  // expenses.total was already in that response, just unused until now.
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
    totalCars:
      (totalCarsQuery.data?.meta.total ?? 0) - (outOfServiceCarsQuery.data?.meta.total ?? 0),
    availableCars: availableCarsQuery.data?.meta.total ?? 0,
    // RentalsRepository.getSummaryCounts' `active` deliberately excludes a
    // late return (it's carved out into `overdueReturn`, both status
    // ACTIVE) — for "cars currently out" the two need adding back together,
    // otherwise a late return would vanish from this count entirely. Missed
    // pickups (`overduePickup`, still RESERVED — the car never left) are a
    // distinct problem and excluded here rather than inflating "en retard"
    // past the active total itself.
    activeRentals: (rentalSummaryQuery.data?.active ?? 0) + (rentalSummaryQuery.data?.overdueReturn ?? 0),
    overdueRentals: rentalSummaryQuery.data?.overdueReturn ?? 0,
    totalClients: totalClientsQuery.data?.meta.total ?? 0,
    newClientsThisMonth: newClientsQuery.data?.meta.total ?? 0,
    monthProfit: currentProfit,
    monthProfitTrend,
    monthlyFinance,
    occupancy: occupancyQuery.data ?? [],
  };
}
