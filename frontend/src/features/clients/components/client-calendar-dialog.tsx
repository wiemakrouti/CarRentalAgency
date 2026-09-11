import { useMemo, useState } from 'react';
import { CalendarX2, ChevronLeft, ChevronRight, X } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { useRentalsQuery } from '@/features/rentals/hooks/use-rentals';
import {
  DISPLAY_RENTAL_STATUS_BADGE_VARIANT,
  DISPLAY_RENTAL_STATUS_LABELS,
} from '@/features/rentals/lib/rental-labels';
import type { Rental } from '@/features/rentals/api/rentals.api';
import {
  apiDateToLocalDay,
  buildMonthGrid,
  DISPLAY_RENTAL_STATUS_CALENDAR_CLASSES,
  DISPLAY_RENTAL_STATUS_DOT_CLASSES,
  findRentalForDate,
  getDisplayRentalStatus,
  getDisplayRentalStatusSummary,
  splitUpcomingAndHistory,
  type DisplayRentalStatus,
} from '@/features/rentals/lib/rental-calendar';
import type { Client } from '../api/clients.api';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTH_FORMATTER = new Intl.DateTimeFormat('fr-TN', { month: 'long', year: 'numeric' });
const GRID_COLUMNS = 7;

// Every status the grid itself can render — same vocabulary as the Cars
// calendar's legend (RESERVED/ACTIVE/EXTENDED/OVERDUE/COMPLETED). CANCELLED
// is deliberately absent: cancelled reservations are filtered out before
// reaching the grid (see gridRentals), so a legend entry for it would
// promise a color that never appears there — it still shows up, badged, in
// the Historique tab. EXTENDED itself only ever applies to an ACTIVE rental
// (see getDisplayRentalStatus) — once returned, its whole span reads as a
// plain COMPLETED cell.
const LEGEND_STATUSES: DisplayRentalStatus[] = [
  'RESERVED',
  'ACTIVE',
  'EXTENDED',
  'OVERDUE',
  'COMPLETED',
];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDate(iso: string): string {
  return apiDateToLocalDay(iso).toLocaleDateString('fr-TN');
}

function formatAmount(value: string | number): string {
  return `${Number(value).toLocaleString('fr-TN')} DT`;
}

type ClientCalendarDialogProps = {
  client: Client | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The profile sheet's "Voir le calendrier et l'historique" CTA opens this
  // dialog straight on the Historique tab — everywhere else (the row's
  // calendar icon) still lands on the grid, the default.
  defaultTab?: 'calendar' | 'history';
};

// Deliberately not a plain mirror of CarCalendarDialog: the grid keeps the
// Cars calendar's day-by-day framing (same colors, same cancelled-rentals-
// filtered-out rule, same EXTENDED-while-ACTIVE-only distinction), but this
// module adds one client-centric thing on top — a second "Historique" tab
// listing the client's full rental history (cancellations included) and
// upcoming reservations with details.
export function ClientCalendarDialog({
  client,
  open,
  onOpenChange,
  defaultTab = 'calendar',
}: ClientCalendarDialogProps) {
  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [selectedRental, setSelectedRental] = useState<Rental | undefined>(undefined);

  const { data, isLoading, isError, refetch } = useRentalsQuery(
    // 100 is the API's hard max (paginationQuerySchema) — a client
    // realistically won't exceed that within this app's lifetime.
    { clientId: client?.id, pageSize: 100 },
    { enabled: Boolean(client) && open },
  );
  const allRentals = data?.items ?? [];
  // The grid itself mirrors the Cars calendar here: cancelled rentals never
  // occupied a real day, so they're filtered out before marking cells. The
  // Historique tab below is where a client's cancelled reservations still
  // show up — that view is about the full record, the grid is about what
  // actually happened day by day.
  const gridRentals = useMemo(
    () => allRentals.filter((r) => r.status !== 'CANCELLED'),
    [allRentals],
  );

  const today = useMemo(() => new Date(), []);

  const cells = useMemo(() => {
    const grid = buildMonthGrid(viewMonth);
    return grid.map((date) => {
      const rental = findRentalForDate(gridRentals, date, today);
      return {
        date,
        rental,
        status: rental ? getDisplayRentalStatus(rental, date, today) : undefined,
      };
    });
  }, [viewMonth, gridRentals, today]);

  const agendaGroups = useMemo(
    () => splitUpcomingAndHistory(allRentals, today),
    [allRentals, today],
  );

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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[36rem]">
        <DialogHeader>
          <DialogTitle>
            Calendrier des locations —{' '}
            {client ? `${client.firstName} ${client.lastName}` : ''}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <LoadingState message="Chargement du calendrier..." />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (
          <>
            <Tabs defaultValue={defaultTab}>
              <TabsList>
                <TabsTrigger value="calendar">Calendrier</TabsTrigger>
                <TabsTrigger value="history">Historique</TabsTrigger>
              </TabsList>

              <TabsContent value="calendar" className="space-y-3">
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
                              ? `${rental.rentalNumber} — ${DISPLAY_RENTAL_STATUS_LABELS[status!]}`
                              : undefined
                          }
                          className={[
                            'flex h-10 items-center justify-center border-y text-xs transition-colors',
                            !inMonth && 'opacity-30',
                            rental && status
                              ? DISPLAY_RENTAL_STATUS_CALENDAR_CLASSES[status]
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
                      <span className={`h-2.5 w-2.5 rounded-full ${DISPLAY_RENTAL_STATUS_DOT_CLASSES[status]}`} />
                      {DISPLAY_RENTAL_STATUS_LABELS[status]}
                    </div>
                  ))}
                </div>

                {selectedRental && (
                  <div className="relative overflow-hidden rounded-lg border border-border bg-card">
                    <span
                      className={`absolute inset-y-0 left-0 w-1 ${DISPLAY_RENTAL_STATUS_DOT_CLASSES[getDisplayRentalStatusSummary(selectedRental, today)]}`}
                    />
                    <div className="p-3 pl-4 text-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="font-medium">{selectedRental.rentalNumber}</p>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={
                              DISPLAY_RENTAL_STATUS_BADGE_VARIANT[
                                getDisplayRentalStatusSummary(selectedRental, today)
                              ]
                            }
                          >
                            {DISPLAY_RENTAL_STATUS_LABELS[getDisplayRentalStatusSummary(selectedRental, today)]}
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
                        <dt className="text-muted-foreground">Voiture</dt>
                        <dd>
                          {selectedRental.car.brand} {selectedRental.car.model}
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
                        <dt className="text-muted-foreground">Montant</dt>
                        <dd>{formatAmount(selectedRental.totalAmount)}</dd>
                      </dl>
                      {selectedRental.extensions.length > 0 && (
                        <div className="mt-2 border-t border-border pt-2">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Prolongation{selectedRental.extensions.length > 1 ? 's' : ''}
                          </p>
                          <ul className="space-y-0.5 text-xs">
                            {selectedRental.extensions.map((ext) => (
                              <li key={ext.id}>
                                {formatDate(ext.previousReturnDate)} → {formatDate(ext.newReturnDate)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history">
                <div className="max-h-[24rem] space-y-4 overflow-y-auto pr-1">
                  {agendaGroups.upcoming.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        À venir
                      </p>
                      <ul className="space-y-2">
                        {agendaGroups.upcoming.map((rental) => (
                          <AgendaItem key={rental.id} rental={rental} today={today} />
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Historique
                    </p>
                    {agendaGroups.history.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Aucune location passée.</p>
                    ) : (
                      <ul className="space-y-2">
                        {agendaGroups.history.map((rental) => (
                          <AgendaItem key={rental.id} rental={rental} today={today} />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {allRentals.length === 0 && (
              <>
                <Separator />
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    <CalendarX2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Aucune location enregistrée pour ce client.
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

function AgendaItem({ rental, today }: { rental: Rental; today: Date }) {
  const status = getDisplayRentalStatusSummary(rental, today);
  return (
    <li className="rounded-xl border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {rental.car.brand} {rental.car.model}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(rental.pickupDate)} → {formatDate(rental.plannedReturnDate)}
          </p>
          <p className="text-xs text-muted-foreground">{rental.rentalNumber}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant={DISPLAY_RENTAL_STATUS_BADGE_VARIANT[status]}>{DISPLAY_RENTAL_STATUS_LABELS[status]}</Badge>
          <span className="text-xs font-medium text-muted-foreground">
            {formatAmount(rental.totalAmount)}
          </span>
        </div>
      </div>
    </li>
  );
}
