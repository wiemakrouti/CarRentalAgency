import type { RentalStatus } from '@car-rental/shared';

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
