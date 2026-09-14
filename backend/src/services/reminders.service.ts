import { prisma } from '../lib/prisma-client.js';
import { RentalsService } from './rentals.service.js';

export type ReminderType =
  | 'RENTAL_RETURN_UPCOMING'
  | 'RENTAL_OVERDUE'
  | 'RENTAL_PICKUP_OVERDUE'
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
    // The notification bell has its own overduePickups query below — without
    // this, a RESERVED rental past its own plannedReturnDate (the exact
    // condition RentalsService.sweepExpiredReservations auto-cancels) would
    // keep surfacing here as "non récupérée depuis le X" with an
    // ever-growing day count forever, even after the Rentals page itself
    // has already stopped showing it. Same sweep, called here too so this
    // module doesn't drift out of sync with the table/KPI header just
    // because an admin checks the bell without ever opening /rentals.
    await RentalsService.sweepExpiredReservations();

    const now = new Date();
    const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    // UTC midnight of today — not `now` itself. MaintenanceRecord.nextDueDate,
    // Client.drivingLicenseExpiry and the three Car document-expiry fields
    // are all date-only values stored as UTC midnight (see car-form-dialog.tsx/
    // client-form-dialog.tsx's dateToInputValue), and the frontend's own
    // car-alerts.ts/client-alerts.ts badges compare against this same UTC
    // calendar day. Flagging `overdue` against the exact instant `now`
    // instead would flip a document to "overdue" the moment any hour of its
    // expiry day ticks by, while the badge elsewhere in the app still reads
    // "expiring soon" for the rest of that day — two views of the same app
    // visibly disagreeing about whether something has expired *today*.
    const todayUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    // The rental queries below reuse this same todayUtcMidnight, not a
    // separate server-local "start of today" — pickupDate/plannedReturnDate
    // get the exact same "not overdue until the day is over" treatment as
    // the calendar-day fields above (rental-calendar.ts's
    // getEffectiveRentalStatus mirrors this same boundary on the frontend),
    // rather than the exact instant `now`, which used to mark a rental
    // "en retard"/"non récupérée" the moment any hour past midnight of its
    // due day ticked by. A local-midnight cutoff here would silently disagree
    // with these UTC-midnight fields by the server's own offset — on a
    // server not running in UTC, up to `offset` early.

    const [dueSoonRentals, overdueRentals, overduePickups, maintenanceDue, licensesExpiring, carsWithDocuments] =
      await Promise.all([
        // deletedAt: null guards against a future archive/delete feature on
        // Rental (none exists today, so this is currently a no-op) — every
        // other Rental query in the app filters it, and a reminder pointing
        // at an archived rental would be a dead click: GET /rentals/:id
        // 404s on an archived row, so the deep link could never resolve.
        prisma.rental.findMany({
          where: { status: 'ACTIVE', deletedAt: null, plannedReturnDate: { gte: todayUtcMidnight, lte: horizon } },
        }),
        prisma.rental.findMany({
          where: { status: 'ACTIVE', deletedAt: null, plannedReturnDate: { lt: todayUtcMidnight } },
        }),
        // A RESERVED rental whose pickupDate has passed without ever being
        // activated — the client never showed up, or the admin forgot to
        // hand over the keys. Overdue-only, no due-soon counterpart: unlike
        // a return (which blocks fleet availability the moment it's late),
        // a reservation that's merely coming up in the next few days needs
        // no proactive alert — only a MISSED one does.
        prisma.rental.findMany({
          where: { status: 'RESERVED', deletedAt: null, pickupDate: { lt: todayUtcMidnight } },
        }),
        // No lower bound: a maintenance due date already in the past is
        // still due (overdue), not filtered out — same fix as the car
        // documents below.
        prisma.maintenanceRecord.findMany({
          where: { deletedAt: null, nextDueDate: { not: null, lte: horizon } },
        }),
        // Client has no soft-delete (see docs/architecture.md § Soft delete),
        // unlike maintenanceRecord above — no deletedAt filter needed here.
        prisma.client.findMany({
          where: { drivingLicenseExpiry: { not: null, lte: horizon } },
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
      ...overduePickups.map(
        (r): Reminder => ({
          type: 'RENTAL_PICKUP_OVERDUE',
          entityType: 'Rental',
          entityId: r.id,
          dueDate: r.pickupDate,
          overdue: true,
          label: `Location ${r.rentalNumber} non récupérée depuis le ${formatDate(r.pickupDate)}`,
        }),
      ),
      ...maintenanceDue.map((m): Reminder => {
        const dueDate = m.nextDueDate as Date;
        const overdue = dueDate < todayUtcMidnight;
        return {
          type: 'MAINTENANCE_DUE',
          entityType: 'MaintenanceRecord',
          entityId: m.id,
          dueDate,
          overdue,
          label: `Maintenance ${overdue ? 'en retard depuis' : 'prévue pour'} le ${formatDate(dueDate)}`,
        };
      }),
      ...licensesExpiring.map((c): Reminder => {
        const dueDate = c.drivingLicenseExpiry as Date;
        const overdue = dueDate < todayUtcMidnight;
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
          const overdue = dueDate < todayUtcMidnight;
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
