import type { ReminderEntityType } from '../api/notifications.api';

// Notifications link to the relevant module's list page, not a specific
// record — none of these entities have a stable "open this one item" URL
// today (detail views are opened from in-page state, e.g. CarDetailSheet).
export const REMINDER_ENTITY_PATH: Record<ReminderEntityType, string> = {
  Car: '/cars',
  Client: '/clients',
  Rental: '/rentals',
  MaintenanceRecord: '/maintenance',
};
