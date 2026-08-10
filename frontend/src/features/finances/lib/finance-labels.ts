import type { ExpenseCategory, PaymentMethod, PaymentStatus, PaymentType } from '@car-rental/shared';

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  RENTAL_PAYMENT: 'Paiement location',
  DEPOSIT: 'Dépôt (caution)',
  DEPOSIT_REFUND: 'Remboursement caution',
  EXTENSION_PAYMENT: 'Prolongation',
  LATE_FEE: 'Frais de retard',
  DAMAGE_FEE: 'Frais de dommage',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  CARD: 'Carte bancaire',
  BANK_TRANSFER: 'Virement',
  CHECK: 'Chèque',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'En attente',
  COMPLETED: 'Encaissé',
  REFUNDED: 'Remboursé',
};

export const PAYMENT_STATUS_BADGE_VARIANT: Record<PaymentStatus, 'default' | 'success' | 'warning' | 'secondary'> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  REFUNDED: 'secondary',
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FUEL: 'Carburant',
  INSURANCE: 'Assurance',
  REPAIR: 'Réparation',
  REGISTRATION: 'Immatriculation',
  OTHER: 'Autre',
};
