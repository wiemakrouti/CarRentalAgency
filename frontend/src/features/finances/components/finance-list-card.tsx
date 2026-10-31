import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type FinanceListCardProps = {
  icon: LucideIcon;
  title: string;
  // One or two short muted lines under the title — what, when, which rental.
  details: string[];
  amount: string;
  // Under the amount: a status badge, or nothing.
  badge?: ReactNode;
  // The row's own "..." menu, if it has one.
  actions?: ReactNode;
  // Where tapping the card goes — absent when there's nowhere to go (an
  // expense not tied to a car), and the card then stays inert.
  onOpen?: () => void;
};

// A ledger row as a card, for phones — shared by the Paiements, Dépenses
// and Cautions tabs, whose tables don't fit a phone. Who/what on the left,
// the amount on the right where the eye looks for it.
export function FinanceListCard({
  icon: Icon,
  title,
  details,
  amount,
  badge,
  actions,
  onOpen,
}: FinanceListCardProps) {
  return (
    <article
      className={cn(
        'relative flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xs transition-colors',
        onOpen && 'has-[>div>button:active]:bg-muted/40',
      )}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-xl bg-primary/10 text-primary-700 dark:text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>

      <div className="min-w-0 flex-1">
        {/* Stretched over the card, so the whole of it opens — the actions
            menu sits above the overlay. */}
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="block w-full truncate text-left text-sm font-semibold after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {title}
          </button>
        ) : (
          <p className="truncate text-sm font-semibold">{title}</p>
        )}
        {details.map((line) => (
          <p key={line} className="truncate text-xs text-muted-foreground">
            {line}
          </p>
        ))}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1 self-start">
        <span className="text-sm font-bold tabular-nums">{amount}</span>
        {badge}
      </div>

      {actions && <div className="relative z-10 -mr-1.5 shrink-0">{actions}</div>}
    </article>
  );
}
