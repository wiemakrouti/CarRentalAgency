import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../api/notifications.api';

const REMINDERS_WITHIN_DAYS = 7;
// Reminders change slowly (dates, not live data) — a background refetch
// every few minutes keeps the bell count reasonably fresh without hammering
// the API on every render.
const REFETCH_INTERVAL_MS = 5 * 60 * 1000;

export function useRemindersQuery() {
  return useQuery({
    queryKey: ['reminders', REMINDERS_WITHIN_DAYS],
    queryFn: () => notificationsApi.getReminders(REMINDERS_WITHIN_DAYS),
    refetchInterval: REFETCH_INTERVAL_MS,
  });
}
