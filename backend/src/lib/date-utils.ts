// Truncates to local midnight — the calendar-day boundary a rental's
// pickupDate/plannedReturnDate (both date-only values) are actually compared
// against to decide whether they've elapsed. Comparing against the exact
// instant `new Date()` instead (as every "is this overdue" check here used
// to) flags a same-day return/pickup as already late the moment any hour
// past midnight ticks by — wrong until the scheduled day has actually
// finished. Mirrors the frontend's own day-truncation (rental-calendar.ts's
// toLocalDayOnly) so both sides agree on what "today" means for these dates.
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfToday(): Date {
  return startOfDay(new Date());
}
