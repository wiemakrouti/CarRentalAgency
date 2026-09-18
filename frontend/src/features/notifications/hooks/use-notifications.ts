import { useQuery } from '@tanstack/react-query';
import { useSettings } from '@/providers/settings-provider';
import { notificationsApi } from '../api/notifications.api';
import { notificationKeys } from '../api/notifications.keys';

// Used only until settings finish loading (or if the request ever fails) —
// matches the agency Settings page's own default (see prisma/seed.ts), not
// a value anything is hardcoded against otherwise.
const DEFAULT_REMINDER_WINDOW_DAYS = 7;

// Reminders change slowly (dates, not live data) — a background refetch
// every few minutes keeps the bell count reasonably fresh without hammering
// the API on every render. Exported so the menu's footer can state this
// cadence in words without a second hardcoded copy of the number.
export const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

// The window itself now lives on the agency's own Settings (reminderWindowDays)
// instead of a hardcoded constant — exported so the notifications menu can
// state the window it's showing ("Échéances des 7 prochains jours") from the
// same source actually sent to the API, without a second copy that could drift.
export function useReminderWindowDays(): number {
  const { settings } = useSettings();
  return settings?.reminderWindowDays ?? DEFAULT_REMINDER_WINDOW_DAYS;
}

export function useRemindersQuery() {
  const withinDays = useReminderWindowDays();
  return useQuery({
    queryKey: notificationKeys.reminders(withinDays),
    queryFn: () => notificationsApi.getReminders(withinDays),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
