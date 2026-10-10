import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CarFront, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api-client';
import { toDateParam } from '@/lib/date-range';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { useQuickActions } from '@/providers/quick-actions-context';
import { useUpdateCarStatusMutation } from '@/features/cars/hooks/use-cars';
import type { PlanningCar } from '@/features/rentals/api/rentals.api';
import { useFleetPlanningQuery } from '@/features/rentals/hooks/use-rentals';
import {
  DISPLAY_RENTAL_STATUS_DOT_CLASSES,
  toLocalDayOnly,
  type DisplayRentalStatus,
} from '@/features/rentals/lib/rental-calendar';
import { DISPLAY_RENTAL_STATUS_LABELS } from '@/features/rentals/lib/rental-labels';

import {
  addDays,
  bookedDayIndexes,
  buildCarBars,
  buildDays,
  CAR_GROUP_LABELS,
  CAR_GROUP_ORDER,
  dayDiff,
  getCarNow,
  NOW_COLUMN_WIDTH,
  PLANNING_VIEW_DAYS,
  PLANNING_VIEW_LABELS,
  startOfWeek,
  type CarGroup,
  type CarNowAction,
  type PlanningLayout,
  type PlanningView,
} from '../lib/fleet-planning';
import { useElementWidth } from '../hooks/use-element-width';
import { useTimelinePan } from '../hooks/use-timeline-pan';
import { PlanningCarRow } from './fleet-planning-row';
import { PlanningRentalActionDialog, type PlanningRentalAction } from './planning-rental-action-dialog';

// Narrower days on longer views, so four weeks still fit a laptop screen;
// below that the planning scrolls sideways instead of squeezing.
const MIN_DAY_WIDTH: Record<PlanningView, number> = { week: 64, twoWeeks: 36, month: 30 };
// Below these widths of its own, the planning switches layout (see
// PlanningLayout) and fits its days to the space instead of a fixed view.
const STACKED_BELOW_PX = 600;
// The full layout as soon as two weeks fit beside its 320px column
// (320 + 14 × 36) — which keeps 1280px laptops on the full layout.
const COMPACT_BELOW_PX = 824;
const COMPACT_DAY_WIDTH = 40;
const STACKED_DAYS = 7;

function pickLayout(width: number): PlanningLayout {
  if (width === 0) return 'full'; // not measured yet
  if (width < STACKED_BELOW_PX) return 'stacked';
  if (width < COMPACT_BELOW_PX) return 'compact';
  return 'full';
}

// Days that fit the layout: the chosen view on desktop; as many as fit
// (one to two weeks) on a tablet; one week across the phone's width.
function fittedDayCount(layout: PlanningLayout, width: number, view: PlanningView): number {
  if (layout === 'stacked') return STACKED_DAYS;
  if (layout === 'compact') {
    const fit = Math.floor((width - NOW_COLUMN_WIDTH.compact) / COMPACT_DAY_WIDTH);
    return Math.min(Math.max(fit, 7), 14);
  }
  return PLANNING_VIEW_DAYS[view];
}
const LEGEND: DisplayRentalStatus[] = ['RESERVED', 'ACTIVE', 'PICKUP_OVERDUE', 'OVERDUE', 'COMPLETED'];

const GROUP_DOT_CLASSES: Record<CarGroup, string> = {
  todo: 'bg-warning',
  out: 'bg-success',
  free: 'bg-primary',
  off: 'bg-muted-foreground/50',
};

type Filter = CarGroup | 'all';

// The day's work stays open; the calmer groups start folded to their
// header and count, one click away — keeps the dashboard short.
const DEFAULT_COLLAPSED: Record<CarGroup, boolean> = { todo: false, out: false, free: true, off: true };
// Looking back in time is looking for history, which mostly sits on cars
// that are free today — so every group starts open there.
const PAST_COLLAPSED: Record<CarGroup, boolean> = { todo: false, out: false, free: false, off: false };

function shortDate(date: Date): string {
  return date.toLocaleDateString('fr-TN', { day: 'numeric', month: 'short' });
}

function weekdayLabel(date: Date): string {
  return date.toLocaleDateString('fr-TN', { weekday: 'short' }).replace('.', '');
}

function isWeekend(date: Date): boolean {
  return date.getDay() === 0 || date.getDay() === 6;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

// The fleet in one place — "parking" and planning combined. Each car shows
// what it is doing right now with its one next step (left), and its days
// over one to four weeks with every rental as a bar (right). Cars are
// grouped by urgency: what needs handling today first, the calmer groups
// folded by default. A bar opens the rental's sheet; a free day opens
// "Nouvelle location" for that car and day.
export function FleetPlanning() {
  const { openRental, openNewRental, openQuickAction } = useQuickActions();
  const updateCarStatus = useUpdateCarStatusMutation();
  const [view, setView] = useState<PlanningView>('twoWeeks');
  const [windowStart, setWindowStart] = useState(() => startOfWeek(new Date()));
  const [filter, setFilter] = useState<Filter>('all');
  // Two independent fold states: the usual one, and the one used while the
  // window lies entirely in the past — returning to today finds the groups
  // folded exactly as they were left.
  const [presentCollapsed, setPresentCollapsed] = useState(DEFAULT_COLLAPSED);
  const [pastCollapsed, setPastCollapsed] = useState(PAST_COLLAPSED);
  const [pendingAction, setPendingAction] = useState<PlanningRentalAction | null>(null);
  const [measureRef, contentWidth] = useElementWidth();
  const layout = pickLayout(contentWidth);

  // Keyed by its date string so the memos below only recompute when the
  // day actually changes, not on every render's fresh Date.
  const todayKey = toDateParam(new Date());
  const today = useMemo(() => toLocalDayOnly(new Date(`${todayKey}T00:00:00`)), [todayKey]);
  const dayCount = fittedDayCount(layout, contentWidth, view);
  const days = useMemo(() => buildDays(windowStart, dayCount), [windowStart, dayCount]);
  // Fetched by whole weeks with a week of margin on each side, so dragging
  // the timeline a day at a time only refetches once it leaves that range
  // (at most ~53 days, under the endpoint's 62-day cap).
  const fetchFrom = toDateParam(addDays(startOfWeek(windowStart), -7));
  const fetchTo = toDateParam(addDays(startOfWeek(addDays(windowStart, dayCount - 1)), 13));
  const { data, isLoading, isError, refetch } = useFleetPlanningQuery(fetchFrom, fetchTo);

  const [timeline, setTimeline] = useState<HTMLDivElement | null>(null);
  useTimelinePan(timeline, {
    leadingColumnWidth: NOW_COLUMN_WIDTH[layout],
    dayCount,
    onShift: (shift) => setWindowStart((start) => addDays(start, shift)),
  });

  const groups = useMemo(() => {
    if (!data) return [];
    const rows = data.cars.map((car) => {
      const { bars, laneCount } = buildCarBars(
        data.rentals.filter((rental) => rental.carId === car.id),
        windowStart,
        dayCount,
        today,
      );
      return { car, now: getCarNow(car, today), bars, laneCount, booked: bookedDayIndexes(bars) };
    });
    return CAR_GROUP_ORDER.map((group) => ({
      group,
      rows: rows.filter((row) => row.now.group === group).sort((a, b) => a.now.rank - b.now.rank),
    }));
  }, [data, windowStart, dayCount, today]);

  const totalCars = data?.cars.length ?? 0;
  const carsOut = data?.cars.filter((car) => car.activeRental).length ?? 0;
  const visibleGroups = groups.filter((g) => g.rows.length > 0 && (filter === 'all' || g.group === filter));

  const minDayWidth = layout === 'full' ? MIN_DAY_WIDTH[view] : layout === 'compact' ? COMPACT_DAY_WIDTH : 0;
  const gridTemplateColumns =
    layout === 'stacked'
      ? `repeat(${dayCount}, minmax(0, 1fr))`
      : `${NOW_COLUMN_WIDTH[layout]}px repeat(${dayCount}, minmax(${minDayWidth}px, 1fr))`;
  const minWidth = NOW_COLUMN_WIDTH[layout] + dayCount * minDayWidth;
  const todayIndex = dayDiff(windowStart, today);
  const viewingPast = todayIndex >= dayCount;
  const collapsed = viewingPast ? pastCollapsed : presentCollapsed;
  const setCollapsed = viewingPast ? setPastCollapsed : setPresentCollapsed;

  const closeAction = useCallback(() => setPendingAction(null), []);

  function handleAction(car: PlanningCar, action: CarNowAction) {
    if (action.kind === 'rent') {
      openNewRental({ carId: car.id, pickupDate: todayKey });
    } else if (action.kind === 'restore') {
      updateCarStatus.mutate(
        { id: car.id, status: 'AVAILABLE' },
        {
          onSuccess: () => toast.success(`${car.brand} ${car.model} est de nouveau disponible.`),
          onError: (err) => toast.error(errorMessage(err, 'Erreur lors de la mise à jour du statut.')),
        },
      );
    } else {
      setPendingAction(action);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">Flotte</CardTitle>
          <CardDescription>
            {shortDate(days[0]!)} – {shortDate(days[days.length - 1]!)} {days[days.length - 1]!.getFullYear()}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              aria-label="Période précédente"
              onClick={() => setWindowStart(addDays(windowStart, -dayCount))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => setWindowStart(startOfWeek(new Date()))}>
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Période suivante"
              onClick={() => setWindowStart(addDays(windowStart, dayCount))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {/* On smaller screens the number of days follows the space instead. */}
          {layout === 'full' && (
            <Tabs value={view} onValueChange={(value) => setView(value as PlanningView)}>
              <TabsList>
                {(Object.keys(PLANNING_VIEW_LABELS) as PlanningView[]).map((key) => (
                  <TabsTrigger key={key} value={key}>
                    {PLANNING_VIEW_LABELS[key]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </div>
      </CardHeader>

      <CardContent ref={measureRef} className="space-y-3">
        {isLoading && <Skeleton className="h-80 rounded-xl" />}
        {isError && !data && <ErrorState title="Impossible de charger la flotte" onRetry={() => refetch()} />}

        {data && totalCars === 0 && (
          <EmptyState
            icon={CarFront}
            title="Aucune voiture dans la flotte"
            description="Ajoutez une voiture pour suivre son planning ici."
            action={<Button onClick={() => openQuickAction('car')}>Ajouter une voiture</Button>}
          />
        )}

        {data && totalCars > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les voitures">
                <FilterChip label="Toutes" count={totalCars} active={filter === 'all'} onClick={() => setFilter('all')} />
                {groups.map(({ group, rows }) => (
                  <FilterChip
                    key={group}
                    label={group === 'todo' ? 'À traiter' : CAR_GROUP_LABELS[group]}
                    count={rows.length}
                    dotClassName={GROUP_DOT_CLASSES[group]}
                    active={filter === group}
                    onClick={() => setFilter(group)}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap text-xs text-muted-foreground">Occupation aujourd'hui</span>
                <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(carsOut / totalCars) * 100}%` }} />
                </div>
                <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                  {carsOut} / {totalCars}
                </span>
              </div>
            </div>

            <div
              ref={setTimeline}
              className="touch-pan-y select-none overflow-x-auto rounded-xl border border-border data-[panning=true]:cursor-grabbing"
            >
              <div style={{ minWidth }}>
                <div className="grid border-b border-border bg-muted/30" style={{ gridTemplateColumns }}>
                  {layout !== 'stacked' && (
                    <div className="flex items-end px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Voiture · maintenant
                    </div>
                  )}
                  {days.map((day, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex flex-col items-center gap-1 border-border/60 py-2',
                        (index > 0 || layout !== 'stacked') && 'border-l',
                        isWeekend(day) && 'bg-muted/50',
                        index === todayIndex && 'bg-primary/5',
                      )}
                    >
                      <span className="text-[11px] font-medium capitalize text-muted-foreground">
                        {view === 'month' ? weekdayLabel(day).charAt(0) : weekdayLabel(day)}
                      </span>
                      <span
                        className={cn(
                          'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold tabular-nums',
                          index === todayIndex && 'bg-primary text-primary-foreground',
                        )}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  ))}
                </div>

                {visibleGroups.map(({ group, rows }) => {
                  // A group picked in the filters is always shown open.
                  const open = filter === group || !collapsed[group];
                  return (
                    <section key={group} aria-label={CAR_GROUP_LABELS[group]}>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setCollapsed({ ...collapsed, [group]: open })}
                        className="flex w-full items-center gap-2.5 border-b border-border/60 bg-muted/30 px-5 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <ChevronDown
                          className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', !open && '-rotate-90')}
                        />
                        <span className={cn('h-2 w-2 rounded-full', GROUP_DOT_CLASSES[group])} />
                        <h3 className="text-xs font-semibold">{CAR_GROUP_LABELS[group]}</h3>
                        <span className="text-xs font-semibold text-muted-foreground tabular-nums">{rows.length}</span>
                      </button>
                      {open &&
                        rows.map((row) => (
                          <PlanningCarRow
                            key={row.car.id}
                            {...row}
                            days={days}
                            todayIndex={todayIndex}
                            today={today}
                            gridTemplateColumns={gridTemplateColumns}
                            layout={layout}
                            compact={layout !== 'full' || view === 'month'}
                            actionPending={updateCarStatus.isPending}
                            onAction={handleAction}
                            onOpenRental={openRental}
                            onBookDay={(car, pickupDate) => openNewRental({ carId: car.id, pickupDate })}
                          />
                        ))}
                    </section>
                  );
                })}

                {visibleGroups.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aucune voiture dans ce groupe.</p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {LEGEND.map((status) => (
                <span key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className={cn('h-2.5 w-2.5 rounded-full', DISPLAY_RENTAL_STATUS_DOT_CLASSES[status])} />
                  {DISPLAY_RENTAL_STATUS_LABELS[status]}
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>

      {pendingAction && <PlanningRentalActionDialog action={pendingAction} onClose={closeAction} />}
    </Card>
  );
}

type FilterChipProps = {
  label: string;
  count: number;
  active: boolean;
  dotClassName?: string;
  onClick: () => void;
};

function FilterChip({ label, count, active, dotClassName, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-secondary-foreground hover:bg-muted',
      )}
    >
      {dotClassName && <span className={cn('h-2 w-2 rounded-full', dotClassName)} />}
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 tabular-nums',
          active ? 'bg-background/20 text-background' : 'bg-muted text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  );
}
