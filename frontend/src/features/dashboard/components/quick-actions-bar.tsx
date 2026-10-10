import type { LucideIcon } from 'lucide-react';
import { CarFront, FilePlus2, Receipt, UserPlus } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useQuickActions, type QuickAction } from '@/providers/quick-actions-context';

const ACTIONS: { action: QuickAction; label: string; icon: LucideIcon }[] = [
  { action: 'rental', label: 'Nouvelle location', icon: FilePlus2 },
  { action: 'client', label: 'Nouveau client', icon: UserPlus },
  { action: 'car', label: 'Nouvelle voiture', icon: CarFront },
  { action: 'expense', label: 'Nouvelle dépense', icon: Receipt },
];

// The day's most common entries, one click from the dashboard — each opens
// the module's own form in place (QuickActionsProvider), no navigation.
// Rounded-square shortcuts with their label underneath; the first (a new
// rental, the agency's core action) is the filled one, the others tinted.
export function QuickActionsBar() {
  const { openQuickAction } = useQuickActions();

  return (
    <div className="grid grid-cols-4 gap-2 sm:flex sm:gap-5">
      {ACTIONS.map(({ action, label, icon: Icon }, index) => {
        const primary = index === 0;
        return (
          <button
            key={action}
            type="button"
            onClick={() => openQuickAction(action)}
            className="group flex min-w-0 flex-col items-center gap-2 rounded-xl text-center sm:w-[84px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span
              className={cn(
                'flex h-[58px] w-[58px] items-center justify-center rounded-[18px] transition-transform group-hover:-translate-y-0.5',
                primary
                  ? 'bg-primary text-primary-foreground shadow-[0_10px_22px_-10px_hsl(var(--primary)/0.85)]'
                  : 'border border-primary-200 bg-primary-50 text-primary-600 group-hover:border-primary/50 dark:border-primary/30 dark:bg-primary/15 dark:text-primary',
              )}
            >
              <Icon className="h-[22px] w-[22px]" />
            </span>
            <span
              className={cn(
                'text-[12.5px] leading-tight',
                primary ? 'font-bold text-primary-700 dark:text-primary' : 'font-semibold text-foreground/80',
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
