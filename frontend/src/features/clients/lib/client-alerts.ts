import type { Client } from '../api/clients.api';

// Same 30-day warning window as the Cars module's car-alerts.ts, and as the
// backend's licenseStatus filter (clients.repository.ts) — kept in sync
// manually since one's a display computation and the other a Prisma
// date-range filter.
const EXPIRY_WARNING_DAYS = 30;

export type LicenseAlertLevel = 'expired' | 'expiring' | 'ok' | 'not_set';

function daysUntil(dateIso: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateIso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

export function getLicenseAlertLevel(client: Pick<Client, 'drivingLicenseExpiry'>): {
  level: LicenseAlertLevel;
  daysRemaining: number | null;
} {
  if (!client.drivingLicenseExpiry) {
    return { level: 'not_set', daysRemaining: null };
  }
  const daysRemaining = daysUntil(client.drivingLicenseExpiry);
  if (daysRemaining < 0) return { level: 'expired', daysRemaining };
  if (daysRemaining <= EXPIRY_WARNING_DAYS) return { level: 'expiring', daysRemaining };
  return { level: 'ok', daysRemaining };
}

export const LICENSE_STATUS_LABELS: Record<LicenseAlertLevel, string> = {
  expired: 'Permis expiré',
  expiring: 'Permis expire bientôt',
  ok: 'Permis à jour',
  not_set: 'Date non renseignée',
};

export function formatLicenseAlertMessage(daysRemaining: number | null, level: LicenseAlertLevel): string {
  if (level === 'not_set' || daysRemaining === null) return 'Date d’expiration non renseignée';
  if (level === 'expired') {
    const overdue = Math.abs(daysRemaining);
    return `Permis expiré depuis ${overdue} jour${overdue > 1 ? 's' : ''}`;
  }
  if (level === 'expiring') {
    return `Permis expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`;
  }
  return 'Permis à jour';
}

// Mirrors the backend's reliabilityRate definition (clients.repository.ts
// getStats/attachReliabilityRates): share of resolved rentals (COMPLETED +
// CANCELLED) that were actually honored. null means no resolved rental yet
// — a brand-new client, not an unreliable one, hence 'new' rather than
// grouping it with 'low'.
export type ReliabilityLevel = 'high' | 'medium' | 'low' | 'new';

const RELIABILITY_HIGH_THRESHOLD = 0.9;
const RELIABILITY_MEDIUM_THRESHOLD = 0.7;

export function getReliabilityLevel(rate: number | null | undefined): ReliabilityLevel {
  if (rate === null || rate === undefined) return 'new';
  if (rate >= RELIABILITY_HIGH_THRESHOLD) return 'high';
  if (rate >= RELIABILITY_MEDIUM_THRESHOLD) return 'medium';
  return 'low';
}

// Labeled as a "Comportement" (behavior) signal in the table — deliberately
// distinct wording from the "Fiabilité" stat card in the profile sheet, even
// though both read the same reliabilityRate: this one is meant as a quick
// priority cue for the admin, not a statistic among others.
export const RELIABILITY_LABELS: Record<ReliabilityLevel, string> = {
  high: 'Sérieux',
  medium: 'À surveiller',
  low: 'À risque',
  new: 'Nouveau',
};

// Counts rather than a percentage — "2 locations annulées sur 8" reads more
// concretely than "75%" for a quick priority call. "terminées" reuses the
// same word as the Rentals module's own COMPLETED status label (rental-
// labels.ts) rather than introducing new vocabulary for the same status.
export function formatReliabilityMessage(
  completedRentals: number | undefined,
  cancelledRentals: number | undefined,
  level: ReliabilityLevel,
): string {
  if (level === 'new' || completedRentals === undefined || cancelledRentals === undefined) {
    return 'Pas encore de location';
  }
  const resolved = completedRentals + cancelledRentals;
  if (cancelledRentals === 0) return `${resolved} location${resolved > 1 ? 's' : ''} terminée${resolved > 1 ? 's' : ''}`;
  return `${cancelledRentals} location${cancelledRentals > 1 ? 's' : ''} annulée${cancelledRentals > 1 ? 's' : ''} sur ${resolved}`;
}
