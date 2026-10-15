import type { LucideIcon } from 'lucide-react';
import { CarFront, ClipboardList, Receipt } from 'lucide-react';
import type { ApprovalStatus, ApprovalType, ExpenseCategory } from '@car-rental/shared';

import { EXPENSE_CATEGORY_LABELS } from '@/features/finances/lib/finance-labels';

// Shown after a submission that became a request (same buttons, same forms).
export const APPROVAL_SENT_MESSAGE = 'Envoyé au directeur pour validation.';
// A car edit: the other fields are saved, only the new rate waits.
export const CAR_RATE_SENT_MESSAGE = 'Voiture mise à jour. Nouveau tarif envoyé au directeur pour validation.';

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Validée',
  REJECTED: 'Refusée',
  WITHDRAWN: 'Retirée',
};

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));

function shortDate(v: unknown): string | null {
  const s = str(v);
  return s ? new Date(s).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : null;
}

// What a request asks for, in one title and one detail line — the same
// wording wherever it shows (journal, the employee's bell).
export function describeApproval(
  type: ApprovalType,
  summary: Record<string, unknown>,
  money: (amount: number) => string,
): { title: string; detail: string; icon: LucideIcon } {
  switch (type) {
    case 'LARGE_DISCOUNT': {
      const nights = (() => {
        const from = str(summary.pickupDate);
        const to = str(summary.plannedReturnDate);
        return from && to ? Math.max(Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000), 1) : null;
      })();
      return {
        title: `Remise de −${num(summary.discountPercent) ?? 0} % sur ${str(summary.car) ?? 'une voiture'}`,
        detail: [
          str(summary.client),
          `${money(num(summary.dailyRate) ?? 0)} / jour au lieu de ${money(num(summary.catalogDailyRate) ?? 0)}`,
          nights !== null ? `${nights} j du ${shortDate(summary.pickupDate)} au ${shortDate(summary.plannedReturnDate)}` : null,
          summary.immediate ? 'Location immédiate' : null,
        ]
          .filter(Boolean)
          .join(' · '),
        icon: ClipboardList,
      };
    }
    case 'LARGE_EXPENSE': {
      const category = str(summary.category) as ExpenseCategory | null;
      const previous = num(summary.previousAmount);
      return {
        title:
          previous !== null
            ? `Dépense modifiée : ${money(previous)} → ${money(num(summary.amount) ?? 0)}`
            : `Dépense de ${money(num(summary.amount) ?? 0)}`,
        detail: [category ? EXPENSE_CATEGORY_LABELS[category] : null, str(summary.description), str(summary.car)]
          .filter(Boolean)
          .join(' · '),
        icon: Receipt,
      };
    }
    case 'CAR_PRICE_CHANGE':
      return {
        title: `Nouveau tarif pour ${str(summary.car) ?? 'une voiture'}`,
        detail: `${money(num(summary.from) ?? 0)} → ${money(num(summary.to) ?? 0)} / jour`,
        icon: CarFront,
      };
  }
}
