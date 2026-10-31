import { ArrowRight, CarFront } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useFormatMoney } from '@/hooks/use-format-money';
import { Badge } from '@/components/ui/badge';

import type { Rental } from '../api/rentals.api';
import { apiDateToLocalDay, getDisplayRentalStatusSummary } from '../lib/rental-calendar';
import {
  DISPLAY_RENTAL_STATUS_BADGE_VARIANT,
  DISPLAY_RENTAL_STATUS_LABELS,
} from '../lib/rental-labels';
import { RentalRowActions } from './rental-row-actions';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function shortDate(date: Date): string {
  return date.toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' });
}

type RentalCardProps = {
  rental: Rental;
  onOpen: (rentalId: string) => void;
};

// The Rentals table's row as a card, for phones — the table's eight columns
// would otherwise scroll sideways. Same content, read top to bottom: which
// car and in what state, for whom, when and for how much; the rental number
// and its actions menu underneath. Tapping the card opens its sheet.
export function RentalCard({ rental, onOpen }: RentalCardProps) {
  const formatMoney = useFormatMoney();
  const status = getDisplayRentalStatusSummary(rental);
  const pickup = apiDateToLocalDay(rental.pickupDate);
  const plannedReturn = apiDateToLocalDay(rental.plannedReturnDate);
  // Nights, as billed — a same-day rental still counts one.
  const days = Math.max(Math.round((plannedReturn.getTime() - pickup.getTime()) / MS_PER_DAY), 1);
  const { firstName, lastName } = rental.client;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const cancelled = rental.status === 'CANCELLED';

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
      <button
        type="button"
        onClick={() => onOpen(rental.id)}
        className="w-full space-y-3 p-4 pb-3 text-left transition-colors active:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-700 dark:text-primary">
            <CarFront className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {rental.car.brand} {rental.car.model}
            </p>
            <p className="truncate text-xs text-muted-foreground">{rental.car.licensePlate}</p>
          </div>
          <Badge variant={DISPLAY_RENTAL_STATUS_BADGE_VARIANT[status]} className="shrink-0">
            {DISPLAY_RENTAL_STATUS_LABELS[status]}
          </Badge>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[10px] font-semibold text-primary-700 dark:bg-primary/15 dark:text-primary">
            {initials}
          </span>
          <span className="truncate">
            {firstName} {lastName}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2">
          <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
            {shortDate(pickup)}
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            {shortDate(plannedReturn)}
            <span className="text-muted-foreground">· {days} j</span>
          </span>
          <span
            className={cn(
              'shrink-0 text-sm font-bold tabular-nums',
              cancelled && 'text-muted-foreground',
            )}
          >
            {/* A cancelled booking's total is only what it would have cost. */}
            {cancelled ? '—' : formatMoney(Number(rental.totalAmount))}
          </span>
        </div>
      </button>

      <div className="flex min-h-11 items-center justify-between border-t border-border/60 pl-4 pr-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{rental.rentalNumber}</span>
        <RentalRowActions rental={rental} />
      </div>
    </article>
  );
}
