import type { RentalStatus } from '@car-rental/shared';
import type { DisplayRentalStatus } from './rental-calendar';

export const RENTAL_STATUS_LABELS: Record<RentalStatus, string> = {
  RESERVED: 'Réservée',
  ACTIVE: 'En cours',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
  OVERDUE: 'Retour en retard',
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
// EXTENDED (days an ACTIVE rental gained through an extension) and
// PICKUP_OVERDUE (a RESERVED rental whose pickup never happened). Both
// calendar dialogs (Cars and Clients), the Rentals table, and the detail
// sheet's stamp need a label/badge for these, so they're defined once here
// rather than duplicated per module.
export const DISPLAY_RENTAL_STATUS_LABELS: Record<DisplayRentalStatus, string> = {
  ...RENTAL_STATUS_LABELS,
  EXTENDED: 'Prolongée',
  PICKUP_OVERDUE: 'Départ en retard',
};

export const DISPLAY_RENTAL_STATUS_BADGE_VARIANT: Record<
  DisplayRentalStatus,
  'default' | 'success' | 'warning' | 'destructive' | 'secondary'
> = {
  ...RENTAL_STATUS_BADGE_VARIANT,
  // Same variant as ACTIVE — EXTENDED is a variant of "currently ongoing",
  // not a distinct status of its own.
  EXTENDED: 'success',
  // Same variant as OVERDUE (a late return) — both are "still a live
  // reservation/rental, but something's late" rather than CANCELLED's
  // destructive dead-end.
  PICKUP_OVERDUE: 'warning',
};
