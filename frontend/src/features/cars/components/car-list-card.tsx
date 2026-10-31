import { CarFront } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useFormatMoney } from '@/hooks/use-format-money';

import type { Car } from '../api/cars.api';
import { getDocumentStatuses, summarizeDocumentStatuses } from '../lib/car-alerts';
import { CAR_CATEGORY_LABELS } from '../lib/car-labels';
import { CarExpiryAlerts } from './car-expiry-alerts';
import { CarRowActions } from './car-row-actions';
import { CarStatusBadge } from './car-status-badge';

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' });
}

type CarListCardProps = {
  car: Car;
  onEdit: (car: Car) => void;
  onViewDetails: (car: Car) => void;
  onOpenCalendar: (car: Car) => void;
};

// The Cars table's row as a card, for phones — a photo beside what the
// table says about the car, its rate and actions underneath, the same
// shape as the Rentals page's RentalCard. Denser than the grid card (whose
// tall photo fits about one car per screen) so a phone can scan the fleet.
export function CarListCard({ car, onEdit, onViewDetails, onOpenCalendar }: CarListCardProps) {
  const formatMoney = useFormatMoney();
  const primary = car.images.find((img) => img.isPrimary) ?? car.images[0];
  const outOfService = car.status === 'OUT_OF_SERVICE';
  // Papers in order are the normal case — only a problem earns room here.
  const documentsNeedAttention =
    !outOfService && summarizeDocumentStatuses(getDocumentStatuses(car)).level !== 'ok';

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-border bg-card shadow-xs',
        outOfService && 'opacity-70',
      )}
    >
      {/* The whole body opens the detail sheet through the name's stretched
          button — the status badge is a button of its own, which a wrapping
          <button> couldn't contain, so it sits above the overlay instead. */}
      <div className="relative flex gap-3 p-3 transition-colors has-[>button:active]:bg-muted/40">
        {primary ? (
          <img
            src={primary.url}
            alt=""
            className="h-[76px] w-[100px] shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-[76px] w-[100px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary/20 dark:to-primary/5">
            <CarFront className="h-8 w-8 text-primary-300" strokeWidth={1.3} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 py-0.5">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => onViewDetails(car)}
              className="block w-full truncate text-left text-sm font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
            >
              {car.brand} {car.model}
            </button>
            <p className="truncate text-xs text-muted-foreground">
              {car.licensePlate} · {CAR_CATEGORY_LABELS[car.category]}
            </p>
          </div>

          <div className="relative z-10 flex min-w-0 flex-wrap items-center gap-1.5 self-start">
            <CarStatusBadge car={car} />
            {documentsNeedAttention && <CarExpiryAlerts car={car} />}
          </div>
        </div>
      </div>

      <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border/60 pl-4 pr-1.5">
        <p className="min-w-0 truncate text-sm">
          <span className="font-bold tabular-nums">{formatMoney(Number(car.dailyRate))}</span>
          <span className="text-xs text-muted-foreground"> /jour</span>
          {car.activeRental && (
            <span className="text-xs text-muted-foreground">
              {' '}
              · retour {shortDate(car.activeRental.plannedReturnDate)}
            </span>
          )}
        </p>
        <CarRowActions
          car={car}
          onEdit={onEdit}
          onViewDetails={onViewDetails}
          onOpenCalendar={onOpenCalendar}
        />
      </div>
    </article>
  );
}
