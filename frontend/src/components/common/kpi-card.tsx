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
  // 'satin': a soft primary-tinted gradient with a diagonal sheen and a
  // plain-colored icon (no boxed badge) — the refined, low-contrast
  // treatment approved for the Dashboard's top KPI row. Opt-in only, so
  // every other KpiCard (Finances included) keeps today's look.
  variant?: 'default' | 'satin';
};

const trendConfig = {
  up: { icon: TrendingUp, className: 'bg-success/10 text-success' },
  down: { icon: TrendingDown, className: 'bg-destructive/10 text-destructive' },
  neutral: { icon: Minus, className: 'bg-muted text-muted-foreground' },
} as const;

export function KpiCard({ label, value, icon: Icon, trend, description, className, variant = 'default' }: KpiCardProps) {
  const TrendIcon = trend ? trendConfig[trend.direction].icon : null;
  const isSatin = variant === 'satin';

  return (
    <Card
      className={cn(
        'relative overflow-hidden shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        isSatin &&
          // The numbered primary-N scale has no dark-mode values in
          // index.css (only bare --primary does) — every other primary-100/
          // primary-700 usage in the app already carries its own dark:
          // fallback onto primary/accent for exactly this reason (see e.g.
          // badge.tsx, page-hero.tsx). Without it, --primary-100 silently
          // falls back to its *light* value (a near-white blue) in dark
          // mode, painting this corner white instead of navy.
          'bg-[linear-gradient(160deg,hsl(var(--primary-100)),hsl(var(--card))_75%)] dark:bg-[linear-gradient(160deg,hsl(var(--primary)/0.18),hsl(var(--card))_75%)]',
        className,
      )}
    >
      {isSatin && (
        // The satin "sheen" — a soft diagonal light streak. Dark mode dims
        // it drastically: the same white streak that reads as elegant on a
        // light gradient would read as a glaring stripe on a dark one.
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,transparent_40%,rgba(255,255,255,.55)_50%,transparent_60%)] dark:bg-[linear-gradient(125deg,transparent_40%,rgba(255,255,255,.06)_50%,transparent_60%)]"
        />
      )}
      <CardHeader className="relative flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <p className={cn('text-sm font-medium', isSatin ? 'text-foreground/70' : 'text-muted-foreground')}>{label}</p>
        {Icon &&
          (isSatin ? (
            <Icon className="h-4 w-4 text-primary-700 dark:text-primary" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 shadow-[0_0_0_1px_hsl(var(--primary-100)),0_6px_16px_-6px_hsl(var(--primary)/0.45)] dark:bg-primary/15 dark:shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_6px_16px_-6px_hsl(var(--primary)/0.35)]">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          ))}
      </CardHeader>
      <CardContent className="relative">
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
          {description && (
            <span className={cn('text-xs', isSatin ? 'text-foreground/60' : 'text-muted-foreground')}>{description}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
