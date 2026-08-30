import type { RentalStatus } from '@car-rental/shared';
import type { DisplayRentalStatus } from './rental-calendar';

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  RESERVED: 'Réservée',
  ACTIVE: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  OVERDUE: 'En retard',
};

export const RENTAL_STATUS_BADGE_VARIANT: Record<
  RentalStatus,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  RESERVED: 'default',
  ACTIVE: 'success',
  COMPLETED: 'secondary',
  CANCELLED: 'destructive',
  OVERDUE: 'warning',
};

// DisplayRentalStatus (rental-calendar.ts) extends RentalStatus with
// EXTENDED — the days an ACTIVE rental gained through an extension. Both
// calendar dialogs (Cars and Clients) need a label/badge for it, so it's
// defined once here rather than duplicated per module.
export const DISPLAY_RENTAL_STATUS_LABELS: Record<DisplayRentalStatus, string> = {
  ...RENTAL_STATUS_LABELS,
  EXTENDED: 'Prolongée',
};

export const DISPLAY_RENTAL_STATUS_BADGE_VARIANT: Record<
  DisplayRentalStatus,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  ...RENTAL_STATUS_BADGE_VARIANT,
  // Same variant as ACTIVE — EXTENDED is a variant of "currently ongoing",
  // not a distinct status of its own.
  EXTENDED: 'success',
};
