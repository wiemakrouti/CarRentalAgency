import type { LucideIcon } from 'lucide-react';
import { CalendarPlus, CarFront, KeyRound, Plus, Undo2, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';
import { toDateParam } from '@/lib/date-range';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PlanningCar } from '@/features/rentals/api/rentals.api';
import { apiDateToLocalDay, DISPLAY_RENTAL_STATUS_CALENDAR_CLASSES } from '@/features/rentals/lib/rental-calendar';
import { DISPLAY_RENTAL_STATUS_LABELS } from '@/features/rentals/lib/rental-labels';

import {
  dayDiff,
  type CarNow,
  type CarNowAction,
  type CarNowKind,
  type PlanningBar,
  type PlanningLayout,
} from '../lib/fleet-planning';

const LANE_HEIGHT: Record<PlanningLayout, number> = { full: 44, compact: 40, stacked: 36 };

// Icon tint per state — the same status families as the bars and badges:
// late in amber, a return in green, a departure in blue.
const NOW_ICON_CLASSES: Record<CarNowKind, string> = {
  OVERDUE_RETURN: 'bg-warning/15 text-warning-foreground dark:text-warning',
  OVERDUE_PICKUP: 'bg-warning/15 text-warning-foreground dark:text-warning',
  RETURN_TODAY: 'bg-success/15 text-green-700 dark:text-success',
  DEPARTURE_TODAY: 'bg-primary/15 text-primary-700 dark:text-primary',
  OUT: 'bg-success/15 text-green-700 dark:text-success',
  FREE: 'bg-secondary text-secondary-foreground',
  UNAVAILABLE: 'bg-muted text-muted-foreground',
};

const NOW_TEXT_CLASSES: Record<CarNowKind, string> = {
  OVERDUE_RETURN: 'font-semibold text-warning-foreground dark:text-warning',
  OVERDUE_PICKUP: 'font-semibold text-warning-foreground dark:text-warning',
  RETURN_TODAY: 'font-medium text-green-700 dark:text-success',
  DEPARTURE_TODAY: 'font-medium text-primary-700 dark:text-primary',
  OUT: 'text-foreground/80',
  FREE: 'text-foreground/80',
  UNAVAILABLE: 'text-muted-foreground',
};

const ACTION_ICONS: Record<CarNowAction['kind'], LucideIcon> = {
  return: Undo2,
  activate: KeyRound,
  extend: CalendarPlus,
  rent: Plus,
  restore: Wrench,
};

const ACTION_LABELS: Record<CarNowAction['kind'], string> = {
  return: 'Clôturer',
  activate: 'Remettre les clés',
  extend: 'Prolonger',
  rent: 'Louer',
  restore: 'Remettre en service',
};

function shortDate(date: Date): string {
  return date.toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' });
}

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

// The short line after the client's name: what matters about this rental
// right now, in a few words.
function barDetail(bar: PlanningBar, today: Date): string {
  const { rental } = bar;
  const pickup = apiDateToLocalDay(rental.pickupDate);
  const planned = apiDateToLocalDay(rental.plannedReturnDate);
  switch (bar.status) {
    case 'OVERDUE':
      return `${dayDiff(planned, today)} j de retard`;
    case 'PICKUP_OVERDUE':
      return 'Clés non remises';
    case 'ACTIVE':
      return planned.getTime() === today.getTime() ? "Retour aujourd'hui" : `Retour ${shortDate(planned)}`;
    case 'RESERVED':
      return pickup.getTime() === today.getTime() ? "Départ aujourd'hui" : `${dayDiff(pickup, planned)} j`;
    default:
      return 'Rendue';
  }
}

type PlanningCarRowProps = {
  car: PlanningCar;
  now: CarNow;
  bars: PlanningBar[];
  laneCount: number;
  booked: Set<number>;
  days: Date[];
  todayIndex: number;
  today: Date;
  gridTemplateColumns: string;
  layout: PlanningLayout;
  compact: boolean;
  actionPending: boolean;
  onAction: (car: PlanningCar, action: CarNowAction) => void;
  onOpenRental: (rentalId: string) => void;
  onBookDay: (car: PlanningCar, pickupDate: string) => void;
};

// One car: its "maintenant" cell (state + the one obvious next step), then
// its days — free ones bookable in a click — with its rentals drawn on top.
export function PlanningCarRow({
  car,
  now,
  bars,
  laneCount,
  booked,
  days,
  todayIndex,
  today,
  gridTemplateColumns,
  layout,
  compact,
  actionPending,
  onAction,
  onOpenRental,
  onBookDay,
}: PlanningCarRowProps) {
  const unavailable = now.group === 'off';
  const urgent = now.group === 'todo';
  const stacked = layout === 'stacked';
  // The days start right after the "maintenant" column — or at the first
  // grid column when the car sits on its own line above them.
  const firstDayColumn = stacked ? 1 : 2;
  const ActionIcon = ACTION_ICONS[now.action.kind];
  const actionLabel = ACTION_LABELS[now.action.kind];

  const carInfo = (
    <>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-lg',
          stacked ? 'h-7 w-7' : 'h-9 w-9',
          NOW_ICON_CLASSES[now.kind],
        )}
      >
        <CarFront className={stacked ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">
          {car.brand} {car.model}{' '}
          {layout !== 'compact' && (
            <span className="text-xs font-normal text-muted-foreground">{car.licensePlate}</span>
          )}
        </p>
        <p className={cn('truncate text-xs', NOW_TEXT_CLASSES[now.kind])}>{now.text}</p>
      </div>
      {layout === 'compact' ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={urgent ? 'default' : 'outline'}
              className="h-8 w-8 shrink-0"
              aria-label={actionLabel}
              disabled={now.action.kind === 'restore' && actionPending}
              onClick={() => onAction(car, now.action)}
            >
              <ActionIcon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{actionLabel}</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          size="sm"
          variant={urgent ? 'default' : 'outline'}
          className={cn('shrink-0', stacked && 'h-7 px-2.5')}
          disabled={now.action.kind === 'restore' && actionPending}
          onClick={() => onAction(car, now.action)}
        >
          {actionLabel}
        </Button>
      )}
    </>
  );

  const grid = (
    <div
      className="grid"
      style={{ gridTemplateColumns, gridTemplateRows: `repeat(${laneCount}, ${LANE_HEIGHT[layout]}px)` }}
    >
      {!stacked && (
        <div
          className={cn('flex min-w-0 items-center border-r border-border py-2 pr-3', layout === 'full' ? 'gap-3 pl-5' : 'gap-2.5 pl-4')}
          style={{ gridColumn: 1, gridRow: '1 / -1' }}
        >
          {carInfo}
        </div>
      )}

      {days.map((day, index) => {
        const isToday = index === todayIndex;
        const cellClassName = cn(
          'relative border-border/60',
          (index > 0 || !stacked) && 'border-l',
          isWeekend(day) && 'bg-muted/40',
          isToday && 'bg-primary/5',
          // Maintenance has no known end date — hatched from today onward.
          unavailable &&
            index >= todayIndex &&
            'bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0_5px,transparent_5px_10px)]',
        );
        const style = { gridColumn: index + firstDayColumn, gridRow: '1 / -1' };
        const todayLine = isToday && (
          <span aria-hidden="true" className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary/30" />
        );
        const free = !unavailable && index >= todayIndex && !booked.has(index);
        if (!free) {
          return (
            <div key={index} className={cellClassName} style={style}>
              {todayLine}
            </div>
          );
        }
        return (
          <button
            key={index}
            type="button"
            aria-label={`Nouvelle location : ${car.brand} ${car.model}, ${shortDate(day)}`}
            onClick={() => onBookDay(car, toDateParam(day))}
            className={cn(
              cellClassName,
              'group flex items-center justify-center transition-colors hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none',
            )}
            style={style}
          >
            {todayLine}
            <Plus className="relative h-3.5 w-3.5 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        );
      })}

      {bars.map((bar) => (
        <PlanningBarButton
          key={bar.rental.id}
          bar={bar}
          today={today}
          compact={compact || bar.end - bar.start < 2}
          firstDayColumn={firstDayColumn}
          onOpen={onOpenRental}
        />
      ))}
    </div>
  );

  if (!stacked) return <div className="border-b border-border/60 last:border-b-0">{grid}</div>;

  return (
    <div className="border-b border-border/60 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2.5 px-3 pb-1 pt-2.5">{carInfo}</div>
      {grid}
    </div>
  );
}

type PlanningBarButtonProps = {
  bar: PlanningBar;
  today: Date;
  compact: boolean;
  firstDayColumn: number;
  onOpen: (rentalId: string) => void;
};

function PlanningBarButton({ bar, today, compact, firstDayColumn, onOpen }: PlanningBarButtonProps) {
  const { rental } = bar;
  const detail = barDetail(bar, today);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onOpen(rental.id)}
          aria-label={`${rental.clientName}, ${rental.rentalNumber} : ${DISPLAY_RENTAL_STATUS_LABELS[bar.status]}`}
          className={cn(
            'relative z-10 mx-0.5 my-1.5 flex min-w-0 items-center gap-1 rounded-md border px-2 text-left text-xs transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            DISPLAY_RENTAL_STATUS_CALENDAR_CLASSES[bar.status],
            bar.clippedStart && 'ml-0 rounded-l-none border-l-0',
            bar.clippedEnd && 'mr-0 rounded-r-none border-r-0',
          )}
          style={{ gridColumn: `${bar.start + firstDayColumn} / ${bar.end + firstDayColumn + 1}`, gridRow: bar.lane + 1 }}
        >
          <span className="truncate font-semibold">{rental.clientName}</span>
          {!compact && <span className="truncate opacity-80">· {detail}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent className="space-y-0.5">
        <p className="font-semibold">{rental.clientName}</p>
        <p className="opacity-80">{rental.rentalNumber}</p>
        <p>
          {shortDate(apiDateToLocalDay(rental.pickupDate))} →{' '}
          {shortDate(apiDateToLocalDay(rental.actualReturnDate ?? rental.plannedReturnDate))}
          {' · '}
          {DISPLAY_RENTAL_STATUS_LABELS[bar.status]}
        </p>
        <p>{detail}</p>
        {rental.extensionCount > 0 && <p className="opacity-80">Prolongée {rental.extensionCount} fois</p>}
      </TooltipContent>
    </Tooltip>
  );
}
