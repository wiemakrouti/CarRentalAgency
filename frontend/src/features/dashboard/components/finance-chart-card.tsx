import { useState } from 'react';

import { cn } from '@/lib/utils';
import { ChartCard } from '@/components/common/chart-card';

import { RevenueExpenseChart, type MonthlyFinance } from './revenue-expense-chart';

const SERIES = [
  { key: 'revenue', label: 'Revenu', color: 'hsl(var(--chart-1))' },
  { key: 'expenses', label: 'Dépenses', color: 'hsl(var(--chart-5))' },
] as const;

type SeriesKey = (typeof SERIES)[number]['key'];

// The Finances section's chart: the legend doubles as a toggle, so either
// series can be hidden to read the other on its own.
export function FinanceChartCard({ data, className }: { data: MonthlyFinance[]; className?: string }) {
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({ revenue: true, expenses: true });
  const currentMonth = new Date().toLocaleDateString('fr-TN', { month: 'long' });

  function toggle(key: SeriesKey) {
    // Never hide both — an empty chart reads as "no data".
    const next = { ...visible, [key]: !visible[key] };
    if (next.revenue || next.expenses) setVisible(next);
  }

  return (
    <ChartCard
      className={className}
      contentClassName="h-80"
      title="Revenus vs Dépenses"
      description={`6 derniers mois · ${currentMonth} en cours`}
      actions={
        <div className="flex shrink-0 gap-1 rounded-full bg-muted p-1" role="group" aria-label="Séries affichées">
          {SERIES.map((series) => (
            <button
              key={series.key}
              type="button"
              aria-pressed={visible[series.key]}
              onClick={() => toggle(series.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                visible[series.key] ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: series.color, opacity: visible[series.key] ? 1 : 0.4 }}
              />
              {series.label}
            </button>
          ))}
        </div>
      }
    >
      <RevenueExpenseChart data={data} showRevenue={visible.revenue} showExpenses={visible.expenses} />
    </ChartCard>
  );
}
