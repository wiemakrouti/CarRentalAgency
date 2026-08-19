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

function daysUntil(dateIso: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateIso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

function levelFor(daysRemaining: number): ExpiryAlertLevel {
  if (daysRemaining < 0) return 'expired';
  if (daysRemaining <= EXPIRY_WARNING_DAYS) return 'expiring';
  return 'ok';
}

// Only returns entries for dates that are set and not comfortably in the
// future — a car with no expiry alerts returns an empty array, not one
// "ok" entry per field, so callers can render nothing rather than clutter.
export function getCarExpiryAlerts(car: Car): ExpiryAlert[] {
  const alerts: ExpiryAlert[] = [];
  for (const { field, label } of EXPIRY_FIELDS) {
    const date = car[field];
    if (!date) continue;
    const daysRemaining = daysUntil(date);
    const level = levelFor(daysRemaining);
    if (level === 'ok') continue;
    alerts.push({ field, label, date, daysRemaining, level });
  }
  // Worst (most overdue / soonest) first.
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function formatAlertMessage(alert: ExpiryAlert): string {
  if (alert.level === 'expired') {
    const overdue = Math.abs(alert.daysRemaining);
    return `${alert.label} expirée depuis ${overdue} jour${overdue > 1 ? 's' : ''}`;
  }
  return `${alert.label} expire dans ${alert.daysRemaining} jour${alert.daysRemaining > 1 ? 's' : ''}`;
}

export type DocumentLevel = ExpiryAlertLevel | 'not_set';

export type DocumentStatus = {
  field: ExpiryAlert['field'];
  label: string;
  date: string | null;
  level: DocumentLevel;
  daysRemaining: number | null;
};

// Unlike getCarExpiryAlerts (problems only, for the compact table/grid
// indicator), this returns all three document types regardless of status —
// the car detail sheet has room to show the full picture, not just what
// needs attention.
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

export function formatDocumentStatus(doc: DocumentStatus): string {
  if (doc.level === 'not_set') return 'Date non renseignée';
  if (doc.level === 'ok') return 'À jour';
  if (doc.level === 'expired') {
    const overdue = Math.abs(doc.daysRemaining!);
    return `Expirée depuis ${overdue} jour${overdue > 1 ? 's' : ''}`;
  }
  return `Expire dans ${doc.daysRemaining} jour${doc.daysRemaining! > 1 ? 's' : ''}`;
}
