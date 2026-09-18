import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ChartCardProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function ChartCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: ChartCardProps) {
  return (
    // min-w-0: as a CSS grid item (see DashboardPage's 2-col grid), a Card
    // otherwise defaults to min-width:auto and refuses to shrink below its
    // content's intrinsic width — Recharts' ResponsiveContainer renders an
    // SVG with a real intrinsic size before its own ResizeObserver measures
    // the container, and that was enough to force the whole grid track (and
    // the dashboard page along with it) wider than the viewport on narrow
    // screens instead of the chart simply resizing down to fit.
    <Card className={cn('min-w-0 shadow-xs', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className={cn('h-72', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
