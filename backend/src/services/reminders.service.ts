import { prisma } from '../lib/prisma-client.js';

export type ReminderType =
  | 'RENTAL_RETURN_UPCOMING'
  | 'RENTAL_OVERDUE'
  | 'MAINTENANCE_DUE'
  | 'DRIVING_LICENSE_EXPIRING'
  | 'CAR_INSURANCE_EXPIRING'
  | 'CAR_TECHNICAL_INSPECTION_EXPIRING'
  | 'CAR_REGISTRATION_EXPIRING';

export interface Reminder {
  type: ReminderType;
  entityType: 'Rental' | 'MaintenanceRecord' | 'Client' | 'Car';
  entityId: string;
  dueDate: Date;
  // True once dueDate is in the past (expired/overdue) rather than merely
  // approaching — the frontend uses this to color the notification
  // destructive vs. warning, same distinction as the Cars module's own
  // expiry badges (see features/cars/lib/car-alerts.ts).
  overdue: boolean;
  label: string;
}

const CAR_DOCUMENT_FIELDS = [
  { field: 'insuranceExpiryDate', type: 'CAR_INSURANCE_EXPIRING', label: 'Assurance' },
  {
    field: 'technicalInspectionExpiryDate',
    type: 'CAR_TECHNICAL_INSPECTION_EXPIRING',
    label: 'Contrôle technique',
  },
  { field: 'registrationExpiryDate', type: 'CAR_REGISTRATION_EXPIRING', label: 'Carte grise' },
] as const satisfies { field: string; type: ReminderType; label: string }[];

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-TN');
}

// Consumed by the notification bell (Topbar) — see docs/architecture.md §1
// for why this stays a plain query rather than a cron/email job in v1.
export class RemindersService {
  static async getUpcoming(withinDays = 7): Promise<Reminder[]> {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const [dueSoonRentals, overdueRentals, maintenanceDue, licensesExpiring, carsWithDocuments] =
      await Promise.all([
        prisma.rental.findMany({
          where: { status: 'ACTIVE', plannedReturnDate: { gte: now, lte: horizon } },
        }),
        prisma.rental.findMany({
          where: { status: 'ACTIVE', plannedReturnDate: { lt: now } },
        }),
        // No lower bound: a maintenance due date already in the past is
        // still due (overdue), not filtered out — same fix as the car
        // documents below.
        prisma.maintenanceRecord.findMany({
          where: { deletedAt: null, nextDueDate: { not: null, lte: horizon } },
        }),
        prisma.client.findMany({
          where: { deletedAt: null, drivingLicenseExpiry: { not: null, lte: horizon } },
        }),
        prisma.car.findMany({
          where: {
            OR: CAR_DOCUMENT_FIELDS.map(({ field }) => ({ [field]: { not: null, lte: horizon } })),
          },
        }),
      ]);

    const reminders: Reminder[] = [
      ...dueSoonRentals.map(
        (r): Reminder => ({
          type: 'RENTAL_RETURN_UPCOMING',
          entityType: 'Rental',
          entityId: r.id,
          dueDate: r.plannedReturnDate,
          overdue: false,
          label: `Location ${r.rentalNumber} à rendre le ${formatDate(r.plannedReturnDate)}`,
        }),
      ),
      ...overdueRentals.map(
        (r): Reminder => ({
          type: 'RENTAL_OVERDUE',
          entityType: 'Rental',
          entityId: r.id,
          dueDate: r.plannedReturnDate,
          overdue: true,
          label: `Location ${r.rentalNumber} en retard depuis le ${formatDate(r.plannedReturnDate)}`,
        }),
      ),
      ...maintenanceDue.map((m): Reminder => {
        const dueDate = m.nextDueDate as Date;
        return {
          type: 'MAINTENANCE_DUE',
          entityType: 'MaintenanceRecord',
          entityId: m.id,
          dueDate,
          overdue: dueDate < now,
          label: `Maintenance ${dueDate < now ? 'en retard depuis' : 'prévue pour'} le ${formatDate(dueDate)}`,
        };
      }),
      ...licensesExpiring.map((c): Reminder => {
        const dueDate = c.drivingLicenseExpiry as Date;
        const overdue = dueDate < now;
        return {
          type: 'DRIVING_LICENSE_EXPIRING',
          entityType: 'Client',
          entityId: c.id,
          dueDate,
          overdue,
          label: `Permis de conduire de ${c.firstName} ${c.lastName} ${overdue ? 'expiré depuis' : 'expire'} le ${formatDate(dueDate)}`,
        };
      }),
      ...carsWithDocuments.flatMap((car) =>
        CAR_DOCUMENT_FIELDS.filter(({ field }) => {
          const date = car[field];
          return date !== null && date <= horizon;
        }).map(({ field, type, label }): Reminder => {
          const dueDate = car[field] as Date;
          const overdue = dueDate < now;
          return {
            type,
            entityType: 'Car',
            entityId: car.id,
            dueDate,
            overdue,
            label: `${label} de ${car.brand} ${car.model} (${car.licensePlate}) ${overdue ? 'expirée depuis' : 'expire'} le ${formatDate(dueDate)}`,
          };
        }),
      ),
    ];

    return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }
}
