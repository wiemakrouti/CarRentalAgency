import type { LucideIcon } from 'lucide-react';
import { CarFront, ChevronLeft, ChevronRight, KeyRound, TriangleAlert, Wrench } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { CarGroup } from '../lib/fleet-planning';

// The fleet card's header on a phone (the planning's "stacked" layout):
// a summary with the occupancy ring, a full-width view switch, and the four
// groups as tiles instead of a row of chips that had to be swiped.

const RING_THICKNESS_PX = 5;

export function PhoneFleetSummary({ carsOut, totalCars }: { carsOut: number; totalCars: number }) {
  const percent = totalCars > 0 ? Math.round((carsOut / totalCars) * 100) : 0;
  const track = 'hsl(var(--primary) / 0.15)';
  const mask = `radial-gradient(farthest-side, transparent calc(100% - ${RING_THICKNESS_PX}px), #000 calc(100% - ${RING_THICKNESS_PX - 1}px))`;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <h2 className="text-lg font-bold leading-tight tracking-tight">Flotte</h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{carsOut}</span> sur{' '}
          <span className="tabular-nums">{totalCars}</span> en location
        </p>
      </div>
      <div
        role="img"
        aria-label={`Occupation : ${percent} %`}
        className="relative flex h-14 w-14 shrink-0 items-center justify-center"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--primary)) 0 ${percent}%, ${track} ${percent}% 100%)`,
            mask,
            WebkitMask: mask,
          }}
        />
        <span className="text-sm font-bold tabular-nums">{percent}%</span>
      </div>
    </div>
  );
}

export type PhoneView = 'today' | 'planning';

export function PhoneViewSwitch({
  value,
  onChange,
}: {
  value: PhoneView;
  onChange: (view: PhoneView) => void;
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as PhoneView)}>
      <TabsList className="grid h-11 w-full grid-cols-2">
        <TabsTrigger value="today" className="h-full">
          Aujourd'hui
        </TabsTrigger>
        <TabsTrigger value="planning" className="h-full">
          Planning
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

// Each group keeps one colour everywhere — the same families as the cars'
// state icons and the planning's bars: amber to handle, green out with a
// client, blue free to rent, grey off the road.
const TILES: Record<
  CarGroup,
  { label: string; icon: LucideIcon; iconClass: string; tintClass: string; selectedClass: string }
> = {
  todo: {
    label: 'À traiter',
    icon: TriangleAlert,
    iconClass: 'bg-warning/15 text-warning-foreground dark:text-warning',
    tintClass: 'border-warning/30 bg-warning/[0.07]',
    selectedClass: 'border-warning bg-warning/15 ring-1 ring-warning',
  },
  out: {
    label: 'Louées',
    icon: KeyRound,
    iconClass: 'bg-success/15 text-green-700 dark:text-success',
    tintClass: 'border-success/25 bg-success/[0.06]',
    selectedClass: 'border-success bg-success/15 ring-1 ring-success',
  },
  free: {
    label: 'Libres',
    icon: CarFront,
    iconClass: 'bg-primary/15 text-primary-700 dark:text-primary',
    tintClass: 'border-primary/20 bg-primary/[0.05]',
    selectedClass: 'border-primary bg-primary/15 ring-1 ring-primary',
  },
  off: {
    label: 'Indispo.',
    icon: Wrench,
    iconClass: 'bg-muted text-muted-foreground',
    tintClass: 'border-border bg-muted/40',
    selectedClass: 'border-muted-foreground/60 bg-muted ring-1 ring-muted-foreground/60',
  },
};

type PhoneStatusTilesProps = {
  groups: { group: CarGroup; count: number }[];
  active: CarGroup | 'all';
  // A tile filters on its group; tapping the active one shows every car again.
  onChange: (filter: CarGroup | 'all') => void;
};

export function PhoneStatusTiles({ groups, active, onChange }: PhoneStatusTilesProps) {
  return (
    <div className="grid grid-cols-4 gap-2" role="group" aria-label="Filtrer les voitures">
      {groups.map(({ group, count }) => {
        const { label, icon: Icon, iconClass, tintClass, selectedClass } = TILES[group];
        const selected = active === group;
        const empty = count === 0;
        return (
          <button
            key={group}
            type="button"
            aria-pressed={selected}
            aria-label={`${label} : ${count}`}
            onClick={() => onChange(selected ? 'all' : group)}
            className={cn(
              'flex min-w-0 flex-col gap-1.5 rounded-2xl border p-2.5 text-left transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected ? selectedClass : empty ? 'border-border bg-card' : tintClass,
              // While a filter is on, the other tiles step back.
              active !== 'all' && !selected && 'opacity-60',
            )}
          >
            <span className="flex items-center justify-between gap-1">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                  empty && !selected ? 'bg-muted text-muted-foreground/70' : iconClass,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span
                className={cn(
                  'text-xl font-bold leading-none tabular-nums',
                  empty && !selected && 'text-muted-foreground/60',
                )}
              >
                {count}
              </span>
            </span>
            <span className="truncate text-[11px] font-medium text-muted-foreground">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

type PhoneWeekNavProps = {
  label: string;
  // Whether today lies in the window — the way back is only offered when not.
  showsToday: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
};

export function PhoneWeekNav({
  label,
  showsToday,
  onPrevious,
  onNext,
  onToday,
}: PhoneWeekNavProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-11 flex-1 items-center rounded-xl border border-border">
        <Button
          variant="ghost"
          size="icon"
          className="h-full w-11 rounded-r-none"
          aria-label="Semaine précédente"
          onClick={onPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="flex-1 text-center text-sm font-semibold tabular-nums">{label}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-full w-11 rounded-l-none"
          aria-label="Semaine suivante"
          onClick={onNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {!showsToday && (
        <Button variant="outline" className="h-11 rounded-xl" onClick={onToday}>
          Auj.
        </Button>
      )}
    </div>
  );
}
