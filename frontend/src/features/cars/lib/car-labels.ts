import type { CarCategory, CarStatus, FuelType, Transmission } from '@car-rental/shared';

export const CAR_CATEGORY_LABELS: Record<CarCategory, string> = {
  ECONOMY: 'Économique',
  COMPACT: 'Compacte',
  SUV: 'SUV',
  LUXURY: 'Luxe',
  VAN: 'Utilitaire',
};

export const CAR_STATUS_LABELS: Record<CarStatus, string> = {
  AVAILABLE: 'Disponible',
  RENTED: 'Louée',
  MAINTENANCE: 'Maintenance',
  OUT_OF_SERVICE: 'Hors service',
};

export const CAR_STATUS_BADGE_VARIANT: Record<CarStatus, 'default' | 'success' | 'warning' | 'destructive'> = {
  AVAILABLE: 'success',
  RENTED: 'default',
  MAINTENANCE: 'warning',
  OUT_OF_SERVICE: 'destructive',
};

export const TRANSMISSION_LABELS: Record<Transmission, string> = {
  MANUAL: 'Manuelle',
  AUTOMATIC: 'Automatique',
};

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  GASOLINE: 'Essence',
  DIESEL: 'Diesel',
  HYBRID: 'Hybride',
  ELECTRIC: 'Électrique',
};
