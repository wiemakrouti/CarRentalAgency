import type { LucideIcon } from 'lucide-react';
import { CarFront, ChevronRight, FilePlus2, HandCoins, Receipt, UserPlus } from 'lucide-react';

import { useQuickActions, type QuickAction } from '@/providers/quick-actions-context';

type Shortcut = { action: QuickAction; label: string; hint: string; icon: LucideIcon };

const MAIN: Shortcut = {
  action: 'rental',
  label: 'Nouvelle location',
  hint: 'Réserver une voiture pour un client',
  icon: FilePlus2,
};

const OTHERS: Shortcut[] = [
  { action: 'client', label: 'Client', hint: 'Nouveau client', icon: UserPlus },
  { action: 'car', label: 'Voiture', hint: 'Ajouter au parc', icon: CarFront },
  { action: 'payment', label: 'Paiement', hint: 'Encaisser', icon: HandCoins },
  { action: 'expense', label: 'Dépense', hint: 'Enregistrer', icon: Receipt },
];

// The content of the phone's "+" sheet: a new rental — the agency's core
// action — as one wide button, the other creations in a 2×2 grid under it.
// Each opens its form in place (QuickActionsProvider); `onSelect` closes
// the sheet first.
export function CreateSheetActions({ onSelect }: { onSelect: () => void }) {
  const { openQuickAction } = useQuickActions();

  function run(action: QuickAction) {
    onSelect();
    openQuickAction(action);
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => run(MAIN.action)}
        className="flex w-full items-center gap-3.5 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 p-4 text-left text-primary-foreground shadow-[0_14px_30px_-14px_hsl(var(--primary)/0.9)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:from-primary dark:to-primary"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
          <MAIN.icon className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{MAIN.label}</span>
          <span className="block truncate text-xs text-primary-foreground/80">{MAIN.hint}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 opacity-80" />
      </button>

      <div className="grid grid-cols-2 gap-3">
        {OTHERS.map(({ action, label, hint, icon: Icon }) => (
          <button
            key={action}
            type="button"
            onClick={() => run(action)}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-700 dark:text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{label}</span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
