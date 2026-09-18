import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useFormatMoney } from '@/hooks/use-format-money';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  borderRadius: 'var(--radius)',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '13px',
};

type MonthlyFinance = { month: string; revenue: number; expenses: number };

// Grouped bars, one shared DT axis — deliberately not a dual-axis chart:
// two different scales side by side would invent a correlation that isn't
// in the data. Revenue and expenses are the same unit here, so one axis is
// enough to answer the actual question ("am I profitable this month?") at
// a glance — the visual gap between the two bars is the margin.
export function RevenueExpenseChart({ data }: { data: MonthlyFinance[] }) {
  const formatMoney = useFormatMoney();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `${value / 1000}k`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => [formatMoney(value), name === 'expenses' ? 'Dépenses' : 'Revenu']}
        />
        <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expenses" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
