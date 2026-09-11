import { useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { REVENUE_PAYMENT_TYPES, EXPENSE_CATEGORIES, type ExpenseCategory, type RevenuePaymentType } from '@car-rental/shared';
import { Clock, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { KpiCard } from '@/components/common/kpi-card';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { DateRangeFilter, computeDateRangePreset, toDateParam, type DateRange } from '@/components/common/date-range-filter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useFinanceSummaryQuery } from '../hooks/use-finance-summary';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_TYPE_LABELS } from '../lib/finance-labels';
import { DepositsCard } from './deposits-card';

function formatMoney(amount: number): string {
  return `${amount.toLocaleString('fr-TN')} DT`;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  borderRadius: 'var(--radius)',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '13px',
};

function chartColor(index: number): string {
  return `hsl(var(--chart-${(index % 5) + 1}))`;
}

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// The immediately-preceding period of the same length, for an honest "vs.
// période précédente" comparison that works for any range — a preset month
// or a hand-picked custom range alike — rather than assuming calendar
// months. E.g. 1–8 sept. compares against 24–31 août (8 days each).
function computePreviousPeriod(range: Required<DateRange>): Required<DateRange> {
  const from = parseLocalDate(range.from);
  const to = parseLocalDate(range.to);
  const lengthDays = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(lengthDays - 1));
  return { from: toDateParam(prevFrom), to: toDateParam(prevTo) };
}

type Trend = { value: string; direction: 'up' | 'down' | 'neutral' };

// `invertGood` flips which sign of change reads as "good" (green) — a rise
// in Revenus is good, but the same rise in Dépenses or Paiements en attente
// is not.
//
// A zero previous-period baseline can't go through the normal (current -
// previous) / previous formula — division by zero. Rather than hiding the
// badge, this shows the literal, honest answer to "what's the percentage
// change from zero": ±∞%, still a real (if extreme) value, not an invented
// one. Both periods flat at zero is the one case with truly nothing to
// report.
function computeTrend(current: number, previous: number, invertGood = false): Trend | undefined {
  if (previous === 0 && current === 0) return undefined;

  if (previous === 0) {
    const isGood = invertGood ? current <= 0 : current >= 0;
    return {
      value: `${current >= 0 ? '+' : '−'}∞%`,
      direction: isGood ? 'up' : 'down',
    };
  }

  // Divide by |previous|, not previous — a negative baseline (Résultat net
  // starting the comparison period at a loss) would otherwise flip the
  // percentage's sign relative to the actual direction of change: going
  // from -244 to +26954 is a huge improvement, but (current - previous) /
  // previous divides by a negative number and reports it as a massive drop.
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 100);
  const isGood = invertGood ? pct <= 0 : pct >= 0;
  return {
    value: `${pct >= 0 ? '+' : ''}${pct}%`,
    direction: pct === 0 ? 'neutral' : isGood ? 'up' : 'down',
  };
}

// A breakdown card: a donut visualizing the (non-zero) proportions on the
// left, paired with the exact-figures table on the right — the table stays
// the source of truth for accounting (it lists every key even at 0 DT), the
// donut is purely the "at a glance" read of where the money is concentrated.
type BreakdownRow<Key extends string> = { key: Key; label: string; amount: number };

function BreakdownCard<Key extends string>({
  title,
  columnLabel,
  rows,
}: {
  title: string;
  columnLabel: string;
  rows: BreakdownRow<Key>[];
}) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const chartData = rows.filter((row) => row.amount > 0);
  // Colors are assigned by position in the full `rows` list, not in the
  // (possibly shorter) filtered `chartData` — so a category dropping to 0
  // DT one period never reshuffles every other slice's color the next.
  const colorByKey = new Map(rows.map((row, index) => [row.key, chartColor(index)]));

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center">
        {total > 0 ? (
          <div className="relative mx-auto h-36 w-36 shrink-0 lg:mx-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="amount"
                  nameKey="label"
                  innerRadius={46}
                  outerRadius={66}
                  paddingAngle={3}
                  stroke="none"
                >
                  {chartData.map((row) => (
                    <Cell key={row.key} fill={colorByKey.get(row.key)} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [formatMoney(value), name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm font-bold text-foreground">{formatMoney(total)}</span>
              <span className="text-[10px] text-muted-foreground">total</span>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-36 w-36 shrink-0 items-center justify-center text-center text-xs text-muted-foreground lg:mx-0">
            Aucun montant sur cette période
          </div>
        )}
        <Table className="flex-1">
          <TableHeader>
            <TableRow>
              <TableHead>{columnLabel}</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: row.amount > 0 ? colorByKey.get(row.key) : 'hsl(var(--border))' }}
                    />
                    {row.label}
                  </span>
                </TableCell>
                <TableCell className="text-right">{formatMoney(row.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type FinanceSummaryTabProps = {
  // Lets a click inside this tab switch FinancesPage to its "Cautions" tab —
  // the two live as siblings under one controlled Tabs component there (see
  // FinancesPage), not a route, so this is a plain callback rather than a
  // Link.
  onViewDeposits: () => void;
};

export function FinanceSummaryTab({ onViewDeposits }: FinanceSummaryTabProps) {
  // No "Toutes les dates" option here — unlike the Paiements/Dépenses
  // ledgers, a summary is only ever meaningful over a bounded window.
  const [range, setRange] = useState<DateRange>(computeDateRangePreset('this_month'));

  const { data, isLoading, isError, refetch } = useFinanceSummaryQuery(range.from ?? '', range.to ?? '');

  // Same-length prior period, purely for the KPI trend badges below — kept
  // separate from `data`'s own loading/error handling since a missing or
  // still-loading comparison shouldn't block the period's own numbers from
  // showing (the trend badge just quietly omits itself, see computeTrend).
  const previousRange = range.from && range.to ? computePreviousPeriod({ from: range.from, to: range.to }) : undefined;
  const { data: previousData } = useFinanceSummaryQuery(previousRange?.from ?? '', previousRange?.to ?? '');

  const revenueTrend = previousData && data ? computeTrend(data.revenue.total, previousData.revenue.total) : undefined;
  const expensesTrend =
    previousData && data ? computeTrend(data.expenses.total, previousData.expenses.total, true) : undefined;
  const netTrend = previousData && data ? computeTrend(data.net, previousData.net) : undefined;
  const pendingTrend =
    previousData && data ? computeTrend(data.pendingTotal, previousData.pendingTotal, true) : undefined;

  return (
    <div className="space-y-6">
      <DateRangeFilter value={range} onChange={setRange} />

      {isLoading && <LoadingState message="Calcul du résumé..." />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Revenus"
              value={formatMoney(data.revenue.total)}
              icon={TrendingUp}
              trend={revenueTrend}
              description={revenueTrend ? 'vs. période précédente' : undefined}
            />
            <KpiCard
              label="Dépenses"
              value={formatMoney(data.expenses.total)}
              icon={TrendingDown}
              trend={expensesTrend}
              description={expensesTrend ? 'vs. période précédente' : undefined}
            />
            <KpiCard
              label="Résultat net"
              value={formatMoney(data.net)}
              icon={Wallet}
              trend={netTrend}
              description={netTrend ? 'vs. période précédente' : data.net >= 0 ? 'Positif' : 'Négatif'}
            />
            <KpiCard
              label="Paiements en attente"
              value={formatMoney(data.pendingTotal)}
              icon={Clock}
              trend={pendingTrend}
              description={pendingTrend ? 'vs. période précédente' : 'À encaisser sur la période'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard<RevenuePaymentType>
              title="Revenus par type"
              columnLabel="Type"
              rows={REVENUE_PAYMENT_TYPES.map((type) => ({
                key: type,
                label: PAYMENT_TYPE_LABELS[type],
                amount: data.revenue.byType[type],
              }))}
            />

            <BreakdownCard<ExpenseCategory>
              title="Dépenses par catégorie"
              columnLabel="Catégorie"
              rows={EXPENSE_CATEGORIES.map((category) => ({
                key: category,
                label: EXPENSE_CATEGORY_LABELS[category],
                amount: data.expenses.byCategory[category],
              }))}
            />
          </div>

          <DepositsCard
            collected={data.deposits.collected}
            refunded={data.deposits.refunded}
            onViewDetails={onViewDeposits}
          />
        </>
      )}
    </div>
  );
}
