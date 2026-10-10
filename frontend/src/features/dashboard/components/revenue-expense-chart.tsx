import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { useFormatMoney } from '@/hooks/use-format-money';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  borderRadius: 'var(--radius)',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '13px',
};

// Past months fade back so the month in progress — the one the admin can
// still act on — reads first.
const PAST_OPACITY = 0.35;
const BAR_SIZE = 12;

export type MonthlyFinance = { month: string; revenue: number; expenses: number };

type RevenueExpenseChartProps = {
  data: MonthlyFinance[];
  showRevenue: boolean;
  showExpenses: boolean;
};

function compactAmount(value: number): string {
  if (Math.abs(value) < 1000) return `${Math.round(value)} DT`;
  return `${(value / 1000).toFixed(1).replace('.', ',').replace(',0', '')} k DT`;
}

type BubbleProps = { x?: number | string; y?: number | string; width?: number | string; value?: number | string; index?: number };

// Grouped bars, one shared DT axis — deliberately not a dual-axis chart:
// two different scales side by side would invent a correlation that isn't
// in the data. Revenue and expenses are the same unit here, so one axis is
// enough to answer the actual question ("am I profitable this month?") at
// a glance — the visual gap between the two bars is the margin.
export function RevenueExpenseChart({ data, showRevenue, showExpenses }: RevenueExpenseChartProps) {
  const formatMoney = useFormatMoney();
  const lastIndex = data.length - 1;

  // The current month's revenue, written in a small bubble above its bar.
  function renderBubble({ x, y, width, value, index }: BubbleProps) {
    if (index !== lastIndex || !value) return null;
    const text = compactAmount(Number(value));
    const bubbleWidth = text.length * 6.6 + 16;
    const centerX = Number(x) + Number(width) / 2;
    const top = Number(y) - 30;
    return (
      <g>
        <rect x={centerX - bubbleWidth / 2} y={top} width={bubbleWidth} height={22} rx={11} fill="hsl(var(--foreground))" />
        <text x={centerX} y={top + 15} textAnchor="middle" fontSize={11} fontWeight={700} fill="hsl(var(--background))">
          {text}
        </text>
      </g>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ left: -20, right: 8, top: 36, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tick={({ x, y, payload, index }) => (
            <text
              x={x}
              y={Number(y) + 12}
              textAnchor="middle"
              fontSize={12}
              fontWeight={index === lastIndex ? 700 : 400}
              fill={index === lastIndex ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
            >
              {payload.value}
            </text>
          )}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => `${value / 1000}k`}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
          contentStyle={tooltipStyle}
          formatter={(value: number, name: string) => [formatMoney(value), name === 'expenses' ? 'Dépenses' : 'Revenu']}
        />
        {showRevenue && (
          <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={BAR_SIZE / 2} barSize={BAR_SIZE}>
            {data.map((entry, index) => (
              <Cell key={entry.month} fillOpacity={index === lastIndex ? 1 : PAST_OPACITY} />
            ))}
            <LabelList dataKey="revenue" content={renderBubble} />
          </Bar>
        )}
        {showExpenses && (
          <Bar dataKey="expenses" fill="hsl(var(--chart-5))" radius={BAR_SIZE / 2} barSize={BAR_SIZE}>
            {data.map((entry, index) => (
              <Cell key={entry.month} fillOpacity={index === lastIndex ? 1 : PAST_OPACITY} />
            ))}
          </Bar>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
