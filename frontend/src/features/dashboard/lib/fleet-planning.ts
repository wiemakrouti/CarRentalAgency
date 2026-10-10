import type { PlanningCar, PlanningRental } from '@/features/rentals/api/rentals.api';
import { apiDateToLocalDay, toLocalDayOnly, type DisplayRentalStatus } from '@/features/rentals/lib/rental-calendar';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type PlanningView = 'week' | 'twoWeeks' | 'month';

export const PLANNING_VIEW_DAYS: Record<PlanningView, number> = {
  week: 7,
  twoWeeks: 14,
  month: 28,
};

export const PLANNING_VIEW_LABELS: Record<PlanningView, string> = {
  week: '1 sem.',
  twoWeeks: '2 sem.',
  month: '4 sem.',
};

// How the planning lays a car out, picked from the space it gets:
// - full: the "maintenant" column (320px) beside the days, as on desktop;
// - compact: a narrower column (220px) whose action is an icon, for tablets;
// - stacked: the car on its own line above its days, which then use the
//   whole width — for phones, so the timeline stays readable there too.
export type PlanningLayout = 'full' | 'compact' | 'stacked';

export const NOW_COLUMN_WIDTH: Record<PlanningLayout, number> = { full: 320, compact: 220, stacked: 0 };

export type PlanningBar = {
  rental: PlanningRental;
  status: DisplayRentalStatus;
  // Column indexes within the window, both inclusive.
  start: number;
  end: number;
  // The rental runs on past the window's edge — that side gets no rounding.
  clippedStart: boolean;
  clippedEnd: boolean;
  lane: number;
};

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Whole calendar days from `from` to `to`. Rounded, not floored: a DST
// change makes one "day" 23 or 25 hours long.
export function dayDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// Monday-first, matching every other calendar in the app.
export function startOfWeek(date: Date): Date {
  const day = toLocalDayOnly(date);
  return addDays(day, -((day.getDay() + 6) % 7));
}

export function buildDays(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

// The planning's own status vocabulary — the same DisplayRentalStatus the
// Rentals table and the car/client calendars use, so a bar reads exactly
// like its badge elsewhere. Evaluated for the whole rental (a bar is one
// colour), not day by day: EXTENDED is therefore never produced here.
function barStatus(rental: PlanningRental, today: Date): DisplayRentalStatus {
  if (rental.status === 'RESERVED' && apiDateToLocalDay(rental.pickupDate) < today) return 'PICKUP_OVERDUE';
  if (rental.status === 'ACTIVE' && apiDateToLocalDay(rental.plannedReturnDate) < today) return 'OVERDUE';
  return rental.status;
}

// The days the car is actually held. A finished rental ends on the day it
// really came back (an early return frees the car); a car still out ends
// no earlier than today, however late it is.
function rentalSpan(rental: PlanningRental, today: Date): { first: Date; last: Date } {
  const first = apiDateToLocalDay(rental.pickupDate);
  const planned = apiDateToLocalDay(rental.plannedReturnDate);
  if (rental.status === 'COMPLETED' && rental.actualReturnDate) {
    return { first, last: apiDateToLocalDay(rental.actualReturnDate) };
  }
  if (rental.status === 'ACTIVE' && planned < today) return { first, last: today };
  return { first, last: planned };
}

// One car's bars inside the window, each given a lane so that two rentals
// sharing a day (a return in the morning, the next pickup in the afternoon)
// sit one above the other instead of overlapping.
export function buildCarBars(
  rentals: PlanningRental[],
  windowStart: Date,
  dayCount: number,
  today: Date,
): { bars: PlanningBar[]; laneCount: number } {
  const bars: PlanningBar[] = [];
  const laneEnds: number[] = [];

  const placed = rentals
    .map((rental) => {
      const { first, last } = rentalSpan(rental, today);
      return { rental, start: dayDiff(windowStart, first), end: dayDiff(windowStart, last) };
    })
    .filter((bar) => bar.end >= 0 && bar.start < dayCount)
    .sort((a, b) => a.start - b.start);

  for (const bar of placed) {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd < bar.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = bar.end;
    bars.push({
      rental: bar.rental,
      status: barStatus(bar.rental, today),
      start: Math.max(bar.start, 0),
      end: Math.min(bar.end, dayCount - 1),
      clippedStart: bar.start < 0,
      clippedEnd: bar.end > dayCount - 1,
      lane,
    });
  }

  return { bars, laneCount: Math.max(laneEnds.length, 1) };
}

// Days a new booking can't start on: anything a live (reserved or ongoing)
// rental already holds. A finished rental frees its car, so it never blocks.
export function bookedDayIndexes(bars: PlanningBar[]): Set<number> {
  const booked = new Set<number>();
  for (const bar of bars) {
    if (bar.rental.status === 'COMPLETED') continue;
    for (let i = bar.start; i <= bar.end; i++) booked.add(i);
  }
  return booked;
}

// ---------------------------------------------------------------------------
// The "maintenant" column: what each car is doing today, whatever window the
// planning shows, and the one action that follows from it.

export type CarGroup = 'todo' | 'out' | 'free' | 'off';

export const CAR_GROUP_ORDER: CarGroup[] = ['todo', 'out', 'free', 'off'];

export const CAR_GROUP_LABELS: Record<CarGroup, string> = {
  todo: 'À traiter aujourd’hui',
  out: 'En location',
  free: 'Disponibles',
  off: 'Indisponibles',
};

export type CarNowKind =
  | 'OVERDUE_RETURN'
  | 'OVERDUE_PICKUP'
  | 'RETURN_TODAY'
  | 'DEPARTURE_TODAY'
  | 'OUT'
  | 'FREE'
  | 'UNAVAILABLE';

export type CarNowAction =
  | { kind: 'return' | 'activate' | 'extend'; rentalId: string }
  | { kind: 'rent' }
  | { kind: 'restore' };

export type CarNow = {
  kind: CarNowKind;
  group: CarGroup;
  text: string;
  action: CarNowAction;
  // Sort key within the group — the most pressing first.
  rank: number;
};

const UNAVAILABLE_STATUSES: PlanningCar['status'][] = ['MAINTENANCE', 'OUT_OF_SERVICE'];

function shortDay(date: Date): string {
  return date.toLocaleDateString('fr-TN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// An ongoing rental decides first (a car can't be both out and free); then a
// pickup due today or already missed; then the car's own status.
export function getCarNow(car: PlanningCar, today: Date): CarNow {
  const { activeRental: active, nextReservation: next } = car;

  if (active) {
    const due = apiDateToLocalDay(active.plannedReturnDate);
    const daysLeft = dayDiff(today, due);
    const action: CarNowAction = { kind: 'return', rentalId: active.id };
    if (daysLeft < 0) {
      return {
        kind: 'OVERDUE_RETURN',
        group: 'todo',
        text: `${-daysLeft} j de retard · ${active.clientName}`,
        action,
        rank: 0,
      };
    }
    if (daysLeft === 0) {
      return { kind: 'RETURN_TODAY', group: 'todo', text: `Retour aujourd’hui · ${active.clientName}`, action, rank: 2 };
    }
    return {
      kind: 'OUT',
      group: 'out',
      text: `${daysLeft === 1 ? 'Retour demain' : `Retour dans ${daysLeft} j`} · ${active.clientName}`,
      action: { kind: 'extend', rentalId: active.id },
      rank: daysLeft,
    };
  }

  if (next) {
    const pickup = apiDateToLocalDay(next.pickupDate);
    const action: CarNowAction = { kind: 'activate', rentalId: next.id };
    if (pickup < today) {
      return { kind: 'OVERDUE_PICKUP', group: 'todo', text: `Départ en retard · ${next.clientName}`, action, rank: 1 };
    }
    if (pickup.getTime() === today.getTime()) {
      return { kind: 'DEPARTURE_TODAY', group: 'todo', text: `Départ aujourd’hui · ${next.clientName}`, action, rank: 3 };
    }
  }

  if (UNAVAILABLE_STATUSES.includes(car.status)) {
    const label = car.status === 'MAINTENANCE' ? 'En maintenance' : 'Hors service';
    return {
      kind: 'UNAVAILABLE',
      group: 'off',
      text: next ? `${label} · réservée dès le ${shortDay(apiDateToLocalDay(next.pickupDate))}` : label,
      action: { kind: 'restore' },
      rank: 0,
    };
  }

  // Free: the longest-idle cars first — those are the ones losing money.
  const idleDays = car.lastReturnDate ? Math.max(dayDiff(apiDateToLocalDay(car.lastReturnDate), today), 0) : null;
  let text = idleDays === null ? 'Libre' : idleDays === 0 ? 'Rendue aujourd’hui' : `Libre depuis ${idleDays} j`;
  if (next) text += ` · réservée dès le ${shortDay(apiDateToLocalDay(next.pickupDate))}`;
  return { kind: 'FREE', group: 'free', text, action: { kind: 'rent' }, rank: -(idleDays ?? Number.MAX_SAFE_INTEGER) };
}
