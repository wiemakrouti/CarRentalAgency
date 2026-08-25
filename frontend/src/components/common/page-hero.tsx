import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type PageHeroProps = {
  children: ReactNode;
  className?: string;
};

// Soft gradient panel used at the top of every page, behind the header and
// the page's primary "above the fold" row (KPIs, filters, tabs — whatever
// belongs closest to the title). Purely presentational: a shared wrapper so
// every page picks up the same depth/glow instead of each page re-deriving
// its own gradient.
export function PageHero({ children, className }: PageHeroProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-primary-100 bg-gradient-to-br from-primary-50 via-white to-white p-6 dark:border-primary/20 dark:from-primary/10 dark:via-card dark:to-card md:p-8',
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-primary-200/60 blur-3xl dark:bg-primary/20" />
      <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-primary-300/40 blur-3xl dark:bg-primary/15" />
      <div className="relative z-10 flex flex-col gap-6">{children}</div>
    </div>
  );
}
