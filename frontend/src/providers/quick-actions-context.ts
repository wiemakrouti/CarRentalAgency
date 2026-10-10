import { createContext, useContext } from 'react';

import type { RentalFormPrefill } from '@/features/rentals/components/rental-form-dialog';

// Context + hook live apart from QuickActionsProvider so that file exports
// only a component (keeps React Fast Refresh working on it).

export type QuickAction = 'rental' | 'client' | 'car' | 'payment' | 'expense';

type QuickActionsContextValue = {
  // Opens the regular create form for that record, on top of whatever page
  // is showing — the dashboard's action bar and the Ctrl+K palette both use
  // this instead of navigating to the module first.
  openQuickAction: (action: QuickAction) => void;
  // The "Nouvelle location" form with a car and/or pickup day already
  // filled in — the fleet planning's click on a free day.
  openNewRental: (prefill: RentalFormPrefill) => void;
  // Opens a rental's detail sheet (all its actions: activate, close,
  // extend, payments) without leaving the current page.
  openRental: (rentalId: string) => void;
};

export const QuickActionsContext = createContext<QuickActionsContextValue | undefined>(undefined);

export function useQuickActions() {
  const context = useContext(QuickActionsContext);
  if (!context) throw new Error('useQuickActions must be used within a QuickActionsProvider');
  return context;
}
