// Same key-factory pattern as every other module (see docs/architecture.md
// § Server state) — lets Cars/Clients/Rentals invalidate the bell's reminders
// whenever they change something a reminder is derived from (an expiry date
// renewed, a rental returned/extended, a record deleted), instead of the
// admin waiting out useRemindersQuery's 5-minute refetch interval.
export const notificationKeys = {
  all: ['reminders'] as const,
  reminders: (withinDays: number) => [...notificationKeys.all, withinDays] as const,
};
