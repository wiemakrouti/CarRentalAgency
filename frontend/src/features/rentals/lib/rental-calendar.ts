import type { RentalStatus } from '@car-rental/shared';
import type { Rental } from '@/features/rentals/api/rentals.api';

// Strips any time-of-day from a Date without touching its Y/M/D — for grid
// cells and "today", which are already local calendar days by construction
// (see buildMonthGrid). Exported so other rental views needing the same
// "is this date's day actually over yet" comparison (the detail sheet's
// frise, the activate/return dialogs' late-day previews) share this exact
// truncation instead of each rolling their own.
export function toLocalDayOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Mirrors the backend's read-side rule (docs/api.md "Cars"): OVERDUE is never
// a stored status, just ACTIVE + plannedReturnDate in the past. The calendar
// needs to show it distinctly, so it computes the same condition here rather
// than trusting `rental.status` alone.
//
// Compared by calendar day, not the exact instant `now` — a return due today
// hasn't actually been missed until today is over. Comparing the raw instant
// instead flagged it OVERDUE the moment any hour past midnight of the due day
// ticked by, which is what produced a rental "en retard" on its own return
// day (backend/src/lib/date-utils.ts's startOfToday mirrors this same
// boundary server-side, for the KPI counts/notifications/table filters).
export function getEffectiveRentalStatus(rental: Rental, now: Date = new Date()): RentalStatus {
  if (rental.status === 'ACTIVE' && apiDateToLocalDay(rental.plannedReturnDate) < toLocalDayOnly(now)) {
    return 'OVERDUE';
  }
  return rental.status;
}

// Extracts the calendar day from an API date string using LOCAL getters —
// deliberately not UTC ones. These date-only fields are stored as "local
// midnight" serialized to UTC (e.g. `...T23:00:00.000Z` for a UTC+1 local
// midnight), and every other date display in this app (the Rentals list,
// the extend/return dialogs, etc.) reads them back with plain
// `new Date(iso).toLocaleDateString()` — i.e. local getters. Reading them
// with UTC getters instead, as this function briefly did, silently landed a
// full day earlier than what the rest of the app shows for the exact same
// rental: a client or car calendar for a rental listed as "27/09 → 04/10"
// would mark 26/09 → 03/10. Matching the app-wide convention (local getters)
// is what keeps the calendar's marking agree with the Rentals list for the
// same stored value — not a theoretically "more portable" UTC extraction
// that in practice never matches anything else on screen.
//
// Exported so callers displaying a rental's dates as text (e.g. the
// calendar's selected-rental panel) use the exact same calendar day this
// module marks on the grid.
export function apiDateToLocalDay(value: string): Date {
  return toLocalDayOnly(new Date(value));
}

// Whole-day, inclusive range for calendar display, strictly pickupDate →
// plannedReturnDate — e.g. Aug 22 → Aug 25 marks the 22nd, 23rd, 24th, and
// 25th. Deliberately not actualReturnDate: a late COMPLETED return would
// otherwise extend the marked range past what was actually booked, and the
// calendar's job is to show the *schedule*, not the after-the-fact outcome.
export function rentalCoversDate(rental: Rental, date: Date) {
  const day = toLocalDayOnly(date).getTime();
  const start = apiDateToLocalDay(rental.pickupDate).getTime();
  const end = apiDateToLocalDay(rental.plannedReturnDate).getTime();
  return day >= start && day <= end;
}

// One 6x7 (42-cell) grid for `month`, including the trailing days of the
// previous month and leading days of the next so every week row is full —
// the standard month-calendar layout.
export function buildMonthGrid(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  // Monday-first week, matching the fr-TN locale this app otherwise uses.
  const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - leadingBlank);

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    return date;
  });
}

export const STATUS_PRIORITY: RentalStatus[] = [
  'OVERDUE',
  'ACTIVE',
  'RESERVED',
  'COMPLETED',
  'CANCELLED',
];

// Tinted-cell treatment for the calendar grid — same status vocabulary as
// RENTAL_STATUS_BADGE_VARIANT (rentals/lib/rental-labels.ts), just expressed
// as background/text/border classes instead of a Badge variant name, since a
// filled day cell isn't a badge.
export const RENTAL_STATUS_CALENDAR_CLASSES: Record<RentalStatus, string> = {
  RESERVED: 'bg-primary/10 text-primary border-primary/30',
  ACTIVE: 'bg-success/10 text-success border-success/30',
  OVERDUE: 'bg-warning/15 text-warning border-warning/40',
  COMPLETED: 'bg-secondary text-secondary-foreground border-transparent',
  CANCELLED: 'bg-muted text-muted-foreground border-dashed border-border line-through',
};

// Solid-color swatch for the legend dots and the selected-rental panel's
// accent bar — RENTAL_STATUS_CALENDAR_CLASSES above is a tinted/translucent
// treatment meant for a large day cell, too faint to read as a small dot.
export const RENTAL_STATUS_DOT_CLASSES: Record<RentalStatus, string> = {
  RESERVED: 'bg-primary',
  ACTIVE: 'bg-success',
  OVERDUE: 'bg-warning',
  COMPLETED: 'bg-muted-foreground/50',
  CANCELLED: 'bg-muted-foreground/50',
};

// EXTENDED marks the days an ACTIVE rental gained through an extension,
// apart from its originally-booked days — not a stored/business status (the
// backend never needs it), just a display-only refinement of
// getEffectiveRentalStatus, shared by both the Cars and Clients calendar
// dialogs so it's defined once instead of duplicated per module.
//
// It only ever applies while the rental is ACTIVE: once it's returned
// (COMPLETED), the distinction stops mattering and the whole span — original
// days and extended days alike — reads as a plain completed rental. OVERDUE
// also doesn't split by day: a rental that's gone past its (possibly already
// extended) return date is uniformly "a problem needing attention", not
// "partly extended".
//
// PICKUP_OVERDUE is the RESERVED-side counterpart of OVERDUE: a RESERVED
// rental whose pickupDate has passed without ever being activated (the
// client never showed up), same condition as the RENTAL_PICKUP_OVERDUE
// reminder and the Rentals KPI header's "Départs en retard" tile — without
// it, that rental reads as a plain, on-schedule "Réservée" everywhere this
// type is used (the Rentals table, the detail sheet's stamp, calendar day
// cells), same gap OVERDUE closes for a late return.
export type DisplayRentalStatus = RentalStatus | 'EXTENDED' | 'PICKUP_OVERDUE';

export function hadExtension(rental: Rental): boolean {
  return rental.extensions.length > 0;
}

// The last day of the rental's *original* booking — the previousReturnDate
// of its earliest extension, or plannedReturnDate itself if it was never
// extended. Days after this boundary are the ones an extension added.
function originalPlannedReturnDay(rental: Rental): Date {
  if (rental.extensions.length === 0) return apiDateToLocalDay(rental.plannedReturnDate);
  const earliest = rental.extensions.reduce((min, ext) =>
    apiDateToLocalDay(ext.previousReturnDate).getTime() < apiDateToLocalDay(min.previousReturnDate).getTime()
      ? ext
      : min,
  );
  return apiDateToLocalDay(earliest.previousReturnDate);
}

// Per-day version, for a specific calendar cell — `date` must be an
// already-local calendar day (buildMonthGrid's cells, "today"), same
// convention as rentalCoversDate.
export function getDisplayRentalStatus(
  rental: Rental,
  date: Date,
  now: Date = new Date(),
): DisplayRentalStatus {
  const status = getEffectiveRentalStatus(rental, now);
  // Doesn't depend on `date` — a missed pickup isn't a per-day distinction
  // the way EXTENDED is, it's true for the whole rental for as long as it
  // stays RESERVED. Same calendar-day comparison as getEffectiveRentalStatus
  // above — a pickup scheduled for today isn't missed until today is over.
  if (status === 'RESERVED' && apiDateToLocalDay(rental.pickupDate) < toLocalDayOnly(now)) return 'PICKUP_OVERDUE';
  if (status !== 'ACTIVE' || rental.extensions.length === 0) return status;
  const boundary = originalPlannedReturnDay(rental);
  return toLocalDayOnly(date).getTime() > boundary.getTime() ? 'EXTENDED' : status;
}

// Convenience for contexts with no specific calendar day in hand — an
// agenda/list row summarizing the whole rental, say — evaluated as of the
// rental's own (current) plannedReturnDate, so an ACTIVE rental still within
// its extended days reads as EXTENDED there too, matching what its cells
// show on the grid; a COMPLETED one always reads as plain COMPLETED.
export function getDisplayRentalStatusSummary(rental: Rental, now: Date = new Date()): DisplayRentalStatus {
  return getDisplayRentalStatus(rental, apiDateToLocalDay(rental.plannedReturnDate), now);
}

// Same idea as RENTAL_STATUS_CALENDAR_CLASSES/RENTAL_STATUS_DOT_CLASSES
// above, extended with EXTENDED. Deliberately reuses ACTIVE's green family
// (dashed border instead of solid) rather than a new color — EXTENDED is a
// variant of "currently ongoing", not a distinct status of its own.
export const DISPLAY_RENTAL_STATUS_CALENDAR_CLASSES: Record<DisplayRentalStatus, string> = {
  ...RENTAL_STATUS_CALENDAR_CLASSES,
  EXTENDED: 'bg-success/10 text-success border-success/30 border-dashed',
  // Same warning family as OVERDUE (a late return) rather than CANCELLED's
  // destructive red — still a live reservation needing a decision, not a
  // dead one.
  PICKUP_OVERDUE: 'bg-warning/15 text-warning border-warning/40 border-dashed',
};

export const DISPLAY_RENTAL_STATUS_DOT_CLASSES: Record<DisplayRentalStatus, string> = {
  ...RENTAL_STATUS_DOT_CLASSES,
  EXTENDED: 'bg-success/70',
  PICKUP_OVERDUE: 'bg-warning',
};

// A day cell almost never belongs to more than one rental (RESERVED/ACTIVE
// can't overlap by business rule; COMPLETED/CANCELLED could in principle) —
// when it does, show whichever status is most operationally relevant.
export function findRentalForDate(
  rentals: Rental[],
  date: Date,
  now: Date = new Date(),
): Rental | undefined {
  const covering = rentals.filter((r) => rentalCoversDate(r, date));
  if (covering.length <= 1) return covering[0];
  return covering.sort(
    (a, b) =>
      STATUS_PRIORITY.indexOf(getEffectiveRentalStatus(a, now)) -
      STATUS_PRIORITY.indexOf(getEffectiveRentalStatus(b, now)),
  )[0];
}

// Splits a client's or car's rentals for the Historique tab's two sections.
// "Upcoming" means the reservation genuinely hasn't happened yet: still
// RESERVED (never activated) with a pickup day today or later — a same-day
// pickup counts as upcoming since nothing has actually started. Checking
// only the pickup date (the earlier version of this) miscategorized a
// same-day reservation as "history", and would have just as wrongly done
// the opposite for a rental that got activated (ACTIVE) the same day it was
// picked up — status, not just the date, is what actually distinguishes
// "hasn't started" from everything else (in progress, overdue, completed,
// cancelled, or a RESERVED rental whose pickup day came and went unactivated).
export function splitUpcomingAndHistory(
  rentals: Rental[],
  today: Date,
): { upcoming: Rental[]; history: Rental[] } {
  const todayDay = toLocalDayOnly(today);
  const upcoming: Rental[] = [];
  const history: Rental[] = [];
  for (const rental of rentals) {
    const isUpcoming =
      rental.status === 'RESERVED' && apiDateToLocalDay(rental.pickupDate).getTime() >= todayDay.getTime();
    (isUpcoming ? upcoming : history).push(rental);
  }
  upcoming.sort(
    (a, b) => apiDateToLocalDay(a.pickupDate).getTime() - apiDateToLocalDay(b.pickupDate).getTime(),
  );
  history.sort(
    (a, b) => apiDateToLocalDay(b.pickupDate).getTime() - apiDateToLocalDay(a.pickupDate).getTime(),
  );
  return { upcoming, history };
}
