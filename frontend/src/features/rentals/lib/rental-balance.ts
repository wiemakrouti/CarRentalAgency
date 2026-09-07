import type { Payment } from '@/features/finances/api/finances.api';
import type { Rental } from '../api/rentals.api';

// Payment types that count toward "what the client owes for the rental
// itself" — deliberately excludes DEPOSIT/DEPOSIT_REFUND, which settle a
// separate refundable hold tracked by its own KPI tile (Caution), not the
// rental fee.
const RENTAL_FEE_PAYMENT_TYPES: Payment['type'][] = ['RENTAL_PAYMENT', 'EXTENSION_PAYMENT', 'LATE_FEE', 'DAMAGE_FEE'];

// depositAmount/depositReturned only ever record what's *expected* and
// whether it's been *handed back* — neither tells you whether it was
// actually collected in the first place. This reads the real answer off
// the payments ledger instead, the same "trust the Payment rows, not a
// derived flag" instinct as buildBalance below.
export function depositCollectedAmount(rental: Rental): number {
  return rental.payments
    .filter((p) => p.type === 'DEPOSIT' && p.status === 'COMPLETED')
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

export type BalanceStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
export type Balance = { totalDue: number; settled: number; remaining: number; status: BalanceStatus };

export const BALANCE_LABELS: Record<BalanceStatus, string> = {
  PAID: 'Soldé',
  PARTIAL: 'Partiellement réglé',
  UNPAID: 'Impayé',
};

export const BALANCE_BADGE_VARIANT: Record<BalanceStatus, 'success' | 'warning' | 'destructive'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  UNPAID: 'destructive',
};

// totalAmount already folds in extensions (RentalsService.extend increments
// it directly) but never late/damage fees — those are only ever standalone
// Payment rows created at return, so they have to be added back in here to
// get the *real* total the client owes across the whole rental.
//
// Shared by the rental detail sheet's own balance summary and the Rentals
// table's "Paiement" column (see rental list/table pages) — one definition
// so the two views can never quietly disagree about what "Soldé" means.
export function buildBalance(rental: Rental): Balance {
  const extraFees = rental.payments
    .filter((p) => p.type === 'LATE_FEE' || p.type === 'DAMAGE_FEE')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const totalDue = Number(rental.totalAmount) + extraFees;
  const settled = rental.payments
    .filter((p) => p.status === 'COMPLETED' && RENTAL_FEE_PAYMENT_TYPES.includes(p.type))
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = totalDue - settled;
  const status: BalanceStatus = remaining <= 0 ? 'PAID' : settled > 0 ? 'PARTIAL' : 'UNPAID';
  return { totalDue, settled, remaining, status };
}
