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
  up: { icon: TrendingUp, className: 'text-success' },
  down: { icon: TrendingDown, className: 'text-destructive' },
  neutral: { icon: Minus, className: 'text-muted-foreground' },
} as const;

export function KpiCard({ label, value, icon: Icon, trend, description, className }: KpiCardProps) {
  const TrendIcon = trend ? trendConfig[trend.direction].icon : null;

  return (
    <Card className={cn('shadow-xs', className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight text-foreground">{value}</div>
        <div className="mt-1 flex items-center gap-1.5">
          {trend && TrendIcon && (
            <span className={cn('flex items-center gap-0.5 text-xs font-medium', trendConfig[trend.direction].className)}>
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
