import type { RentalStatus } from '@car-rental/shared';
import type { Rental } from '@/features/rentals/api/rentals.api';

// Mirrors the backend's read-side rule (docs/api.md "Cars"): OVERDUE is never
// a stored status, just ACTIVE + plannedReturnDate in the past. The calendar
// needs to show it distinctly, so it computes the same condition here rather
// than trusting `rental.status` alone.
export function getEffectiveRentalStatus(rental: Rental, now: Date = new Date()): RentalStatus {
  if (rental.status === 'ACTIVE' && new Date(rental.plannedReturnDate) < now) {
    return 'OVERDUE';
  }
  return rental.status;
}

// Extracts the calendar day from an API date string via UTC getters, not
// local ones: the backend always sends these date-only fields as a UTC
// instant (see the seed's daysFromNow()) that isn't necessarily UTC
// midnight — e.g. this dev DB stores "local midnight" pickup dates, which in
// a UTC+1 server timezone serialize as `...T23:00:00.000Z` the *previous*
// UTC day. Reading that with local getters (`new Date(iso); .setHours(0)`)
// would land on the wrong calendar day whenever the browser's offset isn't
// exactly what produced the timestamp. Taking the UTC Y/M/D and rebuilding a
// local date from those components sidesteps both problems at once.
//
// Only ever call this on raw API strings — never on a Date that's already a
// local calendar day (buildMonthGrid's cells, "today"). Doing so would
// re-interpret an already-local midnight as if it were a UTC instant and
// silently shift it by the browser's own offset (the bug this comment used
// to describe having "fixed", before a debug session proved it was actually
// causing a real one-day-late marking shift here).
//
// Exported so callers displaying a rental's dates as text (e.g. the
// calendar's selected-rental panel) use the exact same calendar day this
// module marks on the grid — a plain `new Date(iso).toLocaleDateString()`
// would silently disagree with the marking by a day in this same scenario.
export function apiDateToLocalDay(value: string): Date {
  const source = new Date(value);
  return new Date(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate());
}

// Strips any time-of-day from an already-local Date without touching its
// Y/M/D — for grid cells and "today", which are local calendar days by
// construction (see buildMonthGrid) and must never go through
// apiDateToLocalDay's UTC reinterpretation.
function toLocalDayOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
