import { useMemo, useState } from 'react';
import { CalendarX2, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { useRentalsQuery } from '@/features/rentals/hooks/use-rentals';
import {
  RENTAL_STATUS_BADGE_VARIANT,
  RENTAL_STATUS_LABELS,
} from '@/features/rentals/lib/rental-labels';
import type { Rental } from '@/features/rentals/api/rentals.api';
import type { Car } from '../api/cars.api';
import {
  apiDateToLocalDay,
  buildMonthGrid,
  findRentalForDate,
  getEffectiveRentalStatus,
  RENTAL_STATUS_CALENDAR_CLASSES,
  RENTAL_STATUS_DOT_CLASSES,
} from '../lib/rental-calendar';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('fr-TN', { month: 'long', year: 'numeric' });
const GRID_COLUMNS = 7;

// Every status the calendar can render, always shown in the legend (not just
// the ones present this month) so the color key stays stable as the admin
// navigates months. CANCELLED is deliberately absent — cancelled rentals are
// filtered out before they ever reach the grid, so a legend entry for it
// would promise a color that never appears.
const LEGEND_STATUSES: Rental['status'][] = ['RESERVED', 'ACTIVE', 'OVERDUE', 'COMPLETED'];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Same day this module marks on the grid for this rental — not a plain
// `new Date(iso).toLocaleDateString()`, which can disagree by a day (see
// apiDateToLocalDay's comment in rental-calendar.ts).
function formatDate(iso: string): string {
  return apiDateToLocalDay(iso).toLocaleDateString('fr-TN');
}

type CarCalendarDialogProps = {
  car: Car | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CarCalendarDialog({ car, open, onOpenChange }: CarCalendarDialogProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedRental, setSelectedRental] = useState<Rental | undefined>(undefined);

  const { data, isLoading, isError, refetch } = useRentalsQuery(
    // 100 is the API's hard max (paginationQuerySchema) — a car realistically
    // won't exceed that within this app's lifetime; if it ever does, this
    // becomes a real pagination problem, not a one-line fix.
    { carId: car?.id, pageSize: 100 },
    { enabled: Boolean(car) && open },
  );
  // CANCELLED rentals never occupy the car — filtered out at the source so
  // nothing downstream (marking, click-to-select, the legend) has to special-
  // case them.
  const rentals = (data?.items ?? []).filter((r) => r.status !== 'CANCELLED');

  const today = useMemo(() => new Date(), []);

  // Resolved once per cell (not inline in JSX) so neighbors can be compared
  // by index below — that's what lets consecutive days of the same rental
  // render as one continuous bar instead of a row of isolated squares.
  const cells = useMemo(() => {
    const grid = buildMonthGrid(viewMonth);
    return grid.map((date) => {
      const rental = findRentalForDate(rentals, date, today);
      return {
        date,
        rental,
        status: rental ? getEffectiveRentalStatus(rental, today) : undefined,
      };
    });
  }, [viewMonth, rentals, today]);

  function changeMonth(offset: number) {
    setSelectedRental(undefined);
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  }

  function goToToday() {
    setSelectedRental(undefined);
    setViewMonth(new Date());
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedRental(undefined);
      setViewMonth(new Date());
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[34rem]">
        <DialogHeader>
          <DialogTitle>
            Calendrier des locations —{' '}
            {car ? `${car.brand} ${car.model} (${car.licensePlate})` : ''}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <LoadingState message="Chargement du calendrier..." />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => changeMonth(-1)}
                aria-label="Mois précédent"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold capitalize">
                  {MONTH_FORMATTER.format(viewMonth)}
                </p>
                {!isSameDay(viewMonth, today) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-muted-foreground"
                    onClick={goToToday}
                  >
                    Aujourd'hui
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => changeMonth(1)}
                aria-label="Mois suivant"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <div className="grid grid-cols-7 bg-muted/40 text-center text-xs font-medium text-muted-foreground">
                {WEEKDAY_LABELS.map((label, i) => (
                  <div key={label} className={`py-2 ${i >= 5 ? 'text-muted-foreground/70' : ''}`}>
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1 p-1.5">
                {cells.map((cell, i) => {
                  const { date, rental, status } = cell;
                  const inMonth = date.getMonth() === viewMonth.getMonth();
                  const isToday = isSameDay(date, today);
                  const col = i % GRID_COLUMNS;

                  // Only cells in the SAME row (week) can visually join —
                  // that's the natural calendar-grid seam, same convention
                  // multi-week bookings use in most calendar UIs.
                  const prev = col > 0 ? cells[i - 1] : undefined;
                  const next = col < GRID_COLUMNS - 1 ? cells[i + 1] : undefined;
                  const joinsPrev = Boolean(rental && prev?.rental?.id === rental.id);
                  const joinsNext = Boolean(rental && next?.rental?.id === rental.id);

                  return (
                    <button
                      key={date.toISOString()}
                      type="button"
                      disabled={!rental}
                      onClick={() => setSelectedRental(rental)}
                      title={
                        rental
                          ? `${rental.rentalNumber} — ${RENTAL_STATUS_LABELS[status!]}`
                          : undefined
                      }
                      className={[
                        'flex h-10 items-center justify-center border-y text-xs transition-colors',
                        !inMonth && 'opacity-30',
                        rental && status
                          ? RENTAL_STATUS_CALENDAR_CLASSES[status]
                          : 'border-transparent text-foreground',
                        rental && !joinsPrev && 'rounded-l-md border-l',
                        rental && !joinsNext && 'rounded-r-md border-r',
                        rental && joinsPrev && '-ml-px',
                        rental && 'cursor-pointer hover:brightness-95',
                        isToday && 'ring-1 ring-inset ring-foreground',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {date.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md bg-muted/30 px-3 py-2">
              {LEGEND_STATUSES.map((status) => (
                <div
                  key={status}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${RENTAL_STATUS_DOT_CLASSES[status]}`}
                  />
                  {RENTAL_STATUS_LABELS[status]}
                </div>
              ))}
            </div>

            {selectedRental && (
              <div className="relative overflow-hidden rounded-lg border border-border bg-card">
                <span
                  className={`absolute inset-y-0 left-0 w-1 ${RENTAL_STATUS_DOT_CLASSES[getEffectiveRentalStatus(selectedRental, today)]}`}
                />
                <div className="p-3 pl-4 text-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">{selectedRental.rentalNumber}</p>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={
                          RENTAL_STATUS_BADGE_VARIANT[
                            getEffectiveRentalStatus(selectedRental, today)
                          ]
                        }
                      >
                        {RENTAL_STATUS_LABELS[getEffectiveRentalStatus(selectedRental, today)]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        aria-label="Fermer"
                        onClick={() => setSelectedRental(undefined)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Client</dt>
                    <dd>
                      {selectedRental.client.firstName} {selectedRental.client.lastName}
                    </dd>
                    <dt className="text-muted-foreground">Prise en charge</dt>
                    <dd>{formatDate(selectedRental.pickupDate)}</dd>
                    <dt className="text-muted-foreground">Retour prévu</dt>
                    <dd>{formatDate(selectedRental.plannedReturnDate)}</dd>
                    {selectedRental.actualReturnDate && (
                      <>
                        <dt className="text-muted-foreground">Retour effectif</dt>
                        <dd>{formatDate(selectedRental.actualReturnDate)}</dd>
                      </>
                    )}
                  </dl>
                </div>
              </div>
            )}

            {rentals.length === 0 && (
              <>
                <Separator />
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <CalendarX2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Aucune location enregistrée pour cette voiture.
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
