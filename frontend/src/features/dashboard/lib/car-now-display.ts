import type { LucideIcon } from 'lucide-react';
import { CalendarPlus, KeyRound, Plus, Undo2, Wrench } from 'lucide-react';

import type { CarNowAction, CarNowKind } from './fleet-planning';

// How a car's "maintenant" state looks — shared by the planning's rows and
// the phone's "Aujourd'hui" list, so a state reads the same in both.

// Icon tint per state — the same status families as the bars and badges:
// late in amber, a return in green, a departure in blue.
export const NOW_ICON_CLASSES: Record<CarNowKind, string> = {
  OVERDUE_RETURN: 'bg-warning/15 text-warning-foreground dark:text-warning',
  OVERDUE_PICKUP: 'bg-warning/15 text-warning-foreground dark:text-warning',
  RETURN_TODAY: 'bg-success/15 text-green-700 dark:text-success',
  DEPARTURE_TODAY: 'bg-primary/15 text-primary-700 dark:text-primary',
  OUT: 'bg-success/15 text-green-700 dark:text-success',
  FREE: 'bg-secondary text-secondary-foreground',
  UNAVAILABLE: 'bg-muted text-muted-foreground',
};

export const NOW_TEXT_CLASSES: Record<CarNowKind, string> = {
  OVERDUE_RETURN: 'font-semibold text-warning-foreground dark:text-warning',
  OVERDUE_PICKUP: 'font-semibold text-warning-foreground dark:text-warning',
  RETURN_TODAY: 'font-medium text-green-700 dark:text-success',
  DEPARTURE_TODAY: 'font-medium text-primary-700 dark:text-primary',
  OUT: 'text-foreground/80',
  FREE: 'text-foreground/80',
  UNAVAILABLE: 'text-muted-foreground',
};

export const ACTION_ICONS: Record<CarNowAction['kind'], LucideIcon> = {
  return: Undo2,
  activate: KeyRound,
  extend: CalendarPlus,
  rent: Plus,
  restore: Wrench,
};

export const ACTION_LABELS: Record<CarNowAction['kind'], string> = {
  return: 'Clôturer',
  activate: 'Remettre les clés',
  extend: 'Prolonger',
  rent: 'Louer',
  restore: 'Remettre en service',
};
