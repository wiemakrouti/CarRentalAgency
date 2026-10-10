import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useFormatMoney } from '@/hooks/use-format-money';

import { GaugeCard } from './gauge-card';

type ProfitCardProps = {
  profit: number;
  revenue: number;
  // Percent change vs. the same point last month, or null without a baseline.
  trend: number | null;
};

// This month's net profit, with its margin (profit ÷ revenue) as the ring —
// a loss reads in red rather than as an empty gauge. Opens Finances.
export function ProfitCard({ profit, revenue, trend }: ProfitCardProps) {
  const formatMoney = useFormatMoney();
  const margin = revenue > 0 ? (profit / revenue) * 100 : null;
  const monthName = new Date().toLocaleDateString('fr-TN', { month: 'long' });

  return (
    <Link
      to="/finances"
      aria-label="Voir les finances"
      className="block h-full rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <GaugeCard
        label={`Bénéfice net · ${monthName}`}
        value={formatMoney(profit)}
        percent={margin === null ? null : Math.abs(margin)}
        percentLabel={profit < 0 ? 'de perte' : 'de marge'}
        tone={profit < 0 ? 'destructive' : 'primary'}
      >
        {trend !== null && (
          <p
            className={cn(
              'text-xs font-semibold',
              trend > 0 ? 'text-green-700 dark:text-success' : trend < 0 ? 'text-red-700 dark:text-destructive' : 'text-muted-foreground',
            )}
          >
            {trend > 0 ? '↑' : trend < 0 ? '↓' : '='} {Math.abs(trend).toFixed(0)} % vs. mois dernier
          </p>
        )}
        <p className="text-xs text-muted-foreground">{formatMoney(revenue)} de revenus</p>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
          Voir les finances <ArrowRight className="h-3 w-3" />
        </span>
      </GaugeCard>
    </Link>
  );
}
