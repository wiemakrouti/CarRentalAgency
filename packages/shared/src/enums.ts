/**
 * Keep every value here in sync with the matching enum in backend/prisma/schema.prisma.
 * Prisma's schema DSL can't import from TS, so this file and the Prisma schema
 * are the two places these values live — this is the intentional source of truth
 * for frontend/shared code; schema.prisma is the source of truth for the DB.
 */

export const ROLES = ['ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const CAR_CATEGORIES = ['ECONOMY', 'COMPACT', 'SUV', 'LUXURY', 'VAN'] as const;
export type CarCategory = (typeof CAR_CATEGORIES)[number];

export const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

export const FUEL_TYPES = ['GASOLINE', 'DIESEL', 'HYBRID', 'ELECTRIC'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const CAR_STATUSES = ['AVAILABLE', 'RENTED', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const;
export type CarStatus = (typeof CAR_STATUSES)[number];

export const CLIENT_DOCUMENT_TYPES = [
  'ID_CARD',
  'DRIVING_LICENSE',
  'PASSPORT',
  'OTHER',
] as const;
export type ClientDocumentType = (typeof CLIENT_DOCUMENT_TYPES)[number];

export const RENTAL_STATUSES = [
  'RESERVED',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
  'OVERDUE',
] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];

export const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_TYPES = [
  'RENTAL_PAYMENT',
  'DEPOSIT',
  'DEPOSIT_REFUND',
  'EXTENSION_PAYMENT',
  'LATE_FEE',
  'DAMAGE_FEE',
] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'REFUNDED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const EXPENSE_CATEGORIES = [
  'FUEL',
  'INSURANCE',
  'REPAIR',
  'REGISTRATION',
  'OTHER',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const MAINTENANCE_TYPES = [
  'OIL_CHANGE',
  'TIRE_CHANGE',
  'REPAIR',
  'INSPECTION',
  'CLEANING',
  'OTHER',
] as const;
export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number];

/**
 * Free-form but conventionally UPPER_SNAKE_CASE action names written to AuditLog.action.
 * Not a closed Prisma enum (kept as `String` in schema.prisma) so new actions never need a migration —
 * this list exists only to keep naming consistent across services.
 */
export const AUDIT_ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'RESTORE',
  'RENTAL_ACTIVATE',
  'RENTAL_RETURN',
  'RENTAL_EXTEND',
  'RENTAL_CANCEL',
  'SETTINGS_UPDATE',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];
