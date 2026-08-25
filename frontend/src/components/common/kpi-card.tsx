import type { LucideIcon } from 'lucide-react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Trend = {
  value: string;
  direction: 'up' | 'down' | 'neutral';
};

type KpiCardProps = {
  label: string;
  value: string;
  icon?: LucideIcon;
  trend?: Trend;
  description?: string;
  className?: string;
};

const trendConfig = {
  up: { icon: TrendingUp, className: 'bg-success/10 text-success' },
  down: { icon: TrendingDown, className: 'bg-destructive/10 text-destructive' },
  neutral: { icon: Minus, className: 'bg-muted text-muted-foreground' },
} as const;

export function KpiCard({ label, value, icon: Icon, trend, description, className }: KpiCardProps) {
  const TrendIcon = trend ? trendConfig[trend.direction].icon : null;

  return (
    <Card
      className={cn(
        'shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 shadow-[0_0_0_1px_hsl(var(--primary-100)),0_6px_16px_-6px_hsl(var(--primary)/0.45)] dark:bg-primary/15 dark:shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_6px_16px_-6px_hsl(var(--primary)/0.35)]">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-[27px] font-extrabold tracking-tight tabular-nums text-foreground">{value}</div>
        <div className="mt-2.5 flex items-center gap-1.5">
          {trend && TrendIcon && (
            <span
              className={cn(
                'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold',
                trendConfig[trend.direction].className,
              )}
            >
              <TrendIcon className="h-3.5 w-3.5" />
              {trend.value}
            </span>
          )}
          {description && <span className="text-xs text-muted-foreground">{description}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
