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
  label: string;
}

// Query-only in v1: nothing calls this on a schedule (no cron, no email/SMS
// channel — deliberately out of scope, see docs/architecture.md §1). It exists
// so a future scheduler has a single, already-correct place to read reminders
// from, instead of the data model needing to change when reminders are built.
export class RemindersService {
  static async getUpcoming(withinDays = 7): Promise<Reminder[]> {
    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

    const [dueSoonRentals, overdueRentals, maintenanceDue, licensesExpiring, carsExpiring] =
      await Promise.all([
        prisma.rental.findMany({
          where: { status: 'ACTIVE', plannedReturnDate: { gte: now, lte: horizon } },
        }),
        prisma.rental.findMany({
          where: { status: 'ACTIVE', plannedReturnDate: { lt: now } },
        }),
        prisma.maintenanceRecord.findMany({
          where: { deletedAt: null, nextDueDate: { gte: now, lte: horizon } },
        }),
        prisma.client.findMany({
          where: { deletedAt: null, drivingLicenseExpiry: { gte: now, lte: horizon } },
        }),
        prisma.car.findMany({
          where: {
            deletedAt: null,
            OR: [
              { insuranceExpiryDate: { gte: now, lte: horizon } },
              { technicalInspectionExpiryDate: { gte: now, lte: horizon } },
              { registrationExpiryDate: { gte: now, lte: horizon } },
            ],
          },
        }),
      ]);

    const reminders: Reminder[] = [
      ...dueSoonRentals.map((r) => ({
        type: 'RENTAL_RETURN_UPCOMING' as const,
        entityType: 'Rental' as const,
        entityId: r.id,
        dueDate: r.plannedReturnDate,
        label: `Rental ${r.rentalNumber} due back ${r.plannedReturnDate.toISOString()}`,
      })),
      ...overdueRentals.map((r) => ({
        type: 'RENTAL_OVERDUE' as const,
        entityType: 'Rental' as const,
        entityId: r.id,
        dueDate: r.plannedReturnDate,
        label: `Rental ${r.rentalNumber} is overdue since ${r.plannedReturnDate.toISOString()}`,
      })),
      ...maintenanceDue.map((m) => ({
        type: 'MAINTENANCE_DUE' as const,
        entityType: 'MaintenanceRecord' as const,
        entityId: m.id,
        dueDate: m.nextDueDate as Date,
        label: `Maintenance due for car ${m.carId}`,
      })),
      ...licensesExpiring.map((c) => ({
        type: 'DRIVING_LICENSE_EXPIRING' as const,
        entityType: 'Client' as const,
        entityId: c.id,
        dueDate: c.drivingLicenseExpiry as Date,
        label: `Driving license expiring for ${c.firstName} ${c.lastName}`,
      })),
      ...carsExpiring.map((car) => ({
        type: (car.insuranceExpiryDate && car.insuranceExpiryDate <= horizon
          ? 'CAR_INSURANCE_EXPIRING'
          : car.technicalInspectionExpiryDate && car.technicalInspectionExpiryDate <= horizon
            ? 'CAR_TECHNICAL_INSPECTION_EXPIRING'
            : 'CAR_REGISTRATION_EXPIRING') as ReminderType,
        entityType: 'Car' as const,
        entityId: car.id,
        dueDate: (car.insuranceExpiryDate ??
          car.technicalInspectionExpiryDate ??
          car.registrationExpiryDate) as Date,
        label: `${car.brand} ${car.model} (${car.licensePlate}) has an expiring document`,
      })),
    ];

    return reminders.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }
}
