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

export function getWorstAlertLevel(alerts: ExpiryAlert[]): ExpiryAlertLevel | null {
  if (alerts.some((a) => a.level === 'expired')) return 'expired';
  if (alerts.some((a) => a.level === 'expiring')) return 'expiring';
  return null;
}

export function formatAlertMessage(alert: ExpiryAlert): string {
  if (alert.level === 'expired') {
    const overdue = Math.abs(alert.daysRemaining);
    return `${alert.label} expirée depuis ${overdue} jour${overdue > 1 ? 's' : ''}`;
  }
  return `${alert.label} expire dans ${alert.daysRemaining} jour${alert.daysRemaining > 1 ? 's' : ''}`;
}
