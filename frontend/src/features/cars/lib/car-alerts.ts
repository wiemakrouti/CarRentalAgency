import type { Car } from '../api/cars.api';

// A document is flagged "expiring" inside this window so the admin has time
// to renew it before it lapses; anything further out reads as fine.
const EXPIRY_WARNING_DAYS = 30;

export type ExpiryAlertLevel = 'expired' | 'expiring' | 'ok';

export type ExpiryAlert = {
  field: 'insuranceExpiryDate' | 'technicalInspectionExpiryDate' | 'registrationExpiryDate';
  label: string;
  date: string;
  level: ExpiryAlertLevel;
  daysRemaining: number;
};

const EXPIRY_FIELDS: { field: ExpiryAlert['field']; label: string }[] = [
  { field: 'insuranceExpiryDate', label: 'Assurance' },
  { field: 'technicalInspectionExpiryDate', label: 'Contrôle technique' },
  { field: 'registrationExpiryDate', label: 'Carte grise' },
];

// UTC calendar day, not local — these fields are stored as UTC midnight
// (see car-form-dialog.tsx's dateToInputValue), and RemindersService compares
// the same fields against UTC-midnight-of-today. Using the viewer's local
// midnight instead would make this table's badge disagree with the
// notification bell for anything expiring "today", for however much of the
// day the local zone sits ahead of UTC.
function daysUntil(dateIso: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = new Date(dateIso);
  const targetDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetDay - today) / msPerDay);
}

function levelFor(daysRemaining: number): ExpiryAlertLevel {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= EXPIRY_WARNING_DAYS) return 'expiring';
  return 'ok';
}

export type DocumentLevel = ExpiryAlertLevel | 'not_set';

export type DocumentStatus = {
  field: ExpiryAlert['field'];
  label: string;
  date: string | null;
  level: DocumentLevel;
  daysRemaining: number | null;
};

// Returns all three document types regardless of status — used both by the
// detail sheet's full list and the table/grid's compact CarExpiryAlerts
// indicator (which filters out not_set, since an unset date isn't this
// component's job to prompt for).
export function getDocumentStatuses(car: Car): DocumentStatus[] {
  return EXPIRY_FIELDS.map(({ field, label }) => {
    const date = car[field];
    if (!date) {
      return { field, label, date: null, level: 'not_set', daysRemaining: null };
    }
    const daysRemaining = daysUntil(date);
    return { field, label, date, level: levelFor(daysRemaining), daysRemaining };
  });
}

// Rolls the three per-document statuses into a single worst-first summary —
// backs the table/grid's compact one-badge CarExpiryAlerts indicator, whose
// per-document breakdown (via formatDocumentStatus) lives in its tooltip
// instead of three separate badges. expired beats expiring beats not_set,
// mirroring levelFor/LEVEL_PRIORITY's own "nothing to act on urgently" take
// on a never-entered date — only reached once nothing is actually overdue.
export function summarizeDocumentStatuses(documents: DocumentStatus[]): {
  level: DocumentLevel;
  label: string;
} {
  const expired = documents.filter((d) => d.level === 'expired').length;
  if (expired > 0) return { level: 'expired', label: `${expired} expiré${expired > 1 ? 's' : ''}` };

  const expiring = documents.filter((d) => d.level === 'expiring').length;
  if (expiring > 0) return { level: 'expiring', label: `${expiring} à renouveler` };

  const notSet = documents.filter((d) => d.level === 'not_set').length;
  if (notSet > 0) return { level: 'not_set', label: `${notSet} non renseigné${notSet > 1 ? 's' : ''}` };

  return { level: 'ok', label: 'À jour' };
}

export function formatDocumentStatus(doc: DocumentStatus): string {
  if (doc.level === 'not_set') return 'Date non renseignée';
  if (doc.level === 'ok') return 'À jour';
  if (doc.level === 'expired') {
    const overdue = Math.abs(doc.daysRemaining!);
    return `Expirée depuis ${overdue} jour${overdue > 1 ? 's' : ''}`;
  }
  return `Expire dans ${doc.daysRemaining} jour${doc.daysRemaining! > 1 ? 's' : ''}`;
}
