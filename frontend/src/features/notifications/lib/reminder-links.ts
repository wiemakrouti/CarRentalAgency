import type { Reminder, ReminderEntityType } from '../api/notifications.api';

// Base module page per entity type. MaintenanceRecord has no module of its
// own (the Maintenance page was removed as an empty stub) — it lands on
// Cars instead, since every maintenance record belongs to one.
const REMINDER_ENTITY_PATH: Record<ReminderEntityType, string> = {
  Car: '/cars',
  Client: '/clients',
  Rental: '/rentals',
  MaintenanceRecord: '/cars',
};

// Whether that module's list page knows how to consume `?openId=` to jump
// straight to one record (see the deep-link effect in each page: CarsPage
// opens CarDetailSheet, ClientsPage opens ClientProfileSheet, RentalsPage
// filters the table down to it — there's no rental detail view to open).
// MaintenanceRecord has none: the reminder only carries the record's own id,
// not its carId, so there's nothing to open it into.
const DEEP_LINKABLE: Record<ReminderEntityType, boolean> = {
  Car: true,
  Client: true,
  Rental: true,
  MaintenanceRecord: false,
};

// A notification should land the admin on the specific record it's about,
// not just the module's default list — otherwise every click means hunting
// for the right row all over again.
export function getReminderLink(reminder: Pick<Reminder, 'entityType' | 'entityId'>): string {
  const base = REMINDER_ENTITY_PATH[reminder.entityType];
  if (!DEEP_LINKABLE[reminder.entityType]) return base;
  return `${base}?openId=${encodeURIComponent(reminder.entityId)}`;
}
