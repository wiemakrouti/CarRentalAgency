import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications.api';
import { notificationKeys } from '../api/notifications.keys';

// Exported so the notifications menu can state the window it's showing
// ("Échéances des 7 prochains jours") without hardcoding a second copy of
// this number that could drift from the one actually sent to the API.
export const REMINDERS_WITHIN_DAYS = 7;
// Reminders change slowly (dates, not live data) — a background refetch
// every few minutes keeps the bell count reasonably fresh without hammering
// the API on every render. Exported for the same reason as
// REMINDERS_WITHIN_DAYS — the menu's footer states this cadence in words.
export const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

export function useRemindersQuery() {
  return useQuery({
    queryKey: notificationKeys.reminders(REMINDERS_WITHIN_DAYS),
    queryFn: () => notificationsApi.getReminders(REMINDERS_WITHIN_DAYS),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
