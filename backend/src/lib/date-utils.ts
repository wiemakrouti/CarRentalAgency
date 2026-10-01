// UTC-midnight of the calendar day `date` falls in, read in UTC — the
// calendar-day boundary a rental's pickupDate/plannedReturnDate (both
// date-only values, stored as UTC midnight) are actually compared against to
// decide whether they've elapsed. Comparing against the exact instant
// `new Date()` instead (as every "is this overdue" check here used to) flags
// a same-day return/pickup as already late the moment any hour past midnight
// ticks by — wrong until the scheduled day has actually finished. Also use
// this to truncate a genuine timestamp (actualReturnDate, paidAt...) down to
// the same UTC-midnight representation before comparing it against one of
// those fields.
//
// Never use a *local*-midnight truncation for this (an earlier version of
// this helper did, via `new Date(date.getFullYear(), ...)`) — on any server
// not running in UTC, that silently shifts the result by the server's own
// offset. That bug once made the occupancy heatmap
// (RentalsService.getOccupancy) drop a rental picked up earlier today from
// that very day's count, mis-flagged rentals as overdue up to an hour early,
// and could mis-charge a late fee for a return made in the last stretch of
// the planned day itself.
export function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// The agency's own wall-clock timezone. Each deployment serves a single
// Tunisian agency (see CLAUDE.md § Project Context), so this is a constant
// rather than a per-agency setting.
const AGENCY_TIME_ZONE = 'Africa/Tunis';

// The calendar day `now` falls on *as the agency sees it* (today by
// default), in the same UTC-midnight representation as pickupDate/
// plannedReturnDate — so it compares directly against a date the admin
// picked in an <input type="date">, which the browser reads in Tunis time.
// Unlike startOfDayUTC, this doesn't read the date from UTC: between 00:00
// and 01:00 in Tunis it's still "yesterday" in UTC, so a UTC-based "today"
// disagreed with the browser for that hour. Use it for every rental rule
// that hinges on a calendar day: "today" (overdue/upcoming, auto-cancel,
// same-day handover) and the day a real timestamp fell on (an activation's
// pickupDate, an actualReturnDate).
export function agencyDay(now: Date = new Date()): Date {
  // en-CA formats as YYYY-MM-DD, which new Date() parses as UTC midnight.
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: AGENCY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(day);
}

// `date` is UTC midnight of a calendar day (z.coerce.date() of a
// YYYY-MM-DD query param) — but a real timestamp field (createdAt, paidAt...)
// compared with a plain `lte: date` would exclude almost everything recorded
// that day (anything after 00:00 UTC). Compare against this exclusive start
// of the next day instead, so the whole day is actually covered — the same
// gte-this-day/lt-next-day pattern payments.repository.ts already uses for
// its own `createdAt` range filter.
export function endOfDayExclusive(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000);
}

// Calendar-day string (YYYY-MM-DD) for a Date already truncated to a
// calendar-day boundary (startOfDayUTC, or a date-only field/query param
// that's already UTC midnight). Never `toISOString().slice(0, 10)` for a
// *local*-midnight instant instead: that converts to UTC first, and in any
// timezone ahead of UTC reads as the previous day once converted. Mirrors
// the frontend's identical toDateParam (date-range-filter.tsx) so both sides
// format a given day the same way.
export function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
