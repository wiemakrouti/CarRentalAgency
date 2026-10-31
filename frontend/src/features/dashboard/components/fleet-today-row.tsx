import { CarFront, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { PlanningCar } from '@/features/rentals/api/rentals.api';

import { ACTION_ICONS, ACTION_LABELS, NOW_ICON_CLASSES, NOW_TEXT_CLASSES } from '../lib/car-now-display';
import type { CarNow, CarNowAction } from '../lib/fleet-planning';

type FleetTodayRowProps = {
  car: PlanningCar;
  now: CarNow;
  actionPending: boolean;
  onAction: (car: PlanningCar, action: CarNowAction) => void;
  onOpenRental: (rentalId: string) => void;
};

// One car in the phone's "Aujourd'hui" list: no timeline, just what the car
// is doing now and its one next step, as a full-size button for a thumb.
// Tapping the car opens the rental it's about (ongoing, or next booked).
export function FleetTodayRow({ car, now, actionPending, onAction, onOpenRental }: FleetTodayRowProps) {
  const ActionIcon = ACTION_ICONS[now.action.kind];
  const rentalId = 'rentalId' in now.action ? now.action.rentalId : car.nextReservation?.id;

  const info = (
    <>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', NOW_ICON_CLASSES[now.kind])}>
        <CarFront className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {car.brand} {car.model}{' '}
          <span className="text-xs font-normal text-muted-foreground">{car.licensePlate}</span>
        </span>
        <span className={cn('block truncate text-xs', NOW_TEXT_CLASSES[now.kind])}>{now.text}</span>
      </span>
    </>
  );

  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5 last:border-b-0">
      {rentalId ? (
        <button
          type="button"
          onClick={() => onOpenRental(rentalId)}
          className="-my-1 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {info}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{info}</div>
      )}
      <Button
        variant={now.group === 'todo' ? 'default' : 'outline'}
        className="h-11 shrink-0 gap-1.5 px-3"
        disabled={now.action.kind === 'restore' && actionPending}
        onClick={() => onAction(car, now.action)}
      >
        <ActionIcon className="h-4 w-4" />
        {/* On the narrowest phones the car's name needs the room more. */}
        <span className="max-[380px]:sr-only">{ACTION_LABELS[now.action.kind]}</span>
      </Button>
    </div>
  );
}
