import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CalendarClock, Check, ClipboardList, KeyRound } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { RentalSummary } from '../api/rentals.api';

type Tone = 'blue' | 'red' | 'green';

// What clicking a card sets the table's filters to — mirrors
// RentalListParams (rentals.api.ts). `pickupOverdue` narrows RESERVED
// further than `status` alone can (see the backend validator's comment);
// `status` is still included alongside it purely so the page's own status
// <Select> shows "Réservée" as selected, not left blank.
type CardFilter = { status: string; pickupOverdue?: boolean };

type Segment = {
  label: string;
  value: number;
  status: string;
  tone: Tone;
  icon: LucideIcon;
  filter: CardFilter;
};

// Built entirely from the app's own semantic tokens — primary/destructive/
// success, always through their DEFAULT (theme-adaptive) form or an
// opacity-modified version of it, never the fixed primary-50..900 scale
// (which isn't redefined under .dark — see index.css — so a literal
// `primary-50` wash would stay pale light-blue even on a dark card). That's
// what makes light/dark fall out of the tokens themselves, same as
// elsewhere in the app (e.g. RentalsPage's client-avatar chip using
// `bg-primary-50 dark:bg-primary/15`).
const TONE_CARD: Record<Tone, string> = {
  blue: 'border-primary/15 bg-gradient-to-br from-primary/10 to-card shadow-[0_10px_26px_-14px_hsl(var(--primary)/0.35)]',
  red: 'border-destructive/15 bg-gradient-to-br from-destructive/10 to-card shadow-[0_10px_26px_-14px_hsl(var(--destructive)/0.3)]',
  green:
    'border-success/15 bg-gradient-to-br from-success/10 to-card shadow-[0_10px_26px_-14px_hsl(var(--success)/0.28)]',
};

const TONE_BAR: Record<Tone, string> = {
  blue: 'bg-primary',
  red: 'bg-destructive',
  green: 'bg-success',
};

const TONE_WATERMARK: Record<Tone, string> = {
  blue: 'text-primary/10',
  red: 'text-destructive/10',
  green: 'text-success/10',
};

const TONE_ICON_BOX: Record<Tone, string> = {
  blue: 'bg-primary text-primary-foreground shadow-[0_6px_14px_-4px_hsl(var(--primary)/0.45)]',
  red: 'bg-destructive text-destructive-foreground shadow-[0_6px_14px_-4px_hsl(var(--destructive)/0.4)]',
  green: 'bg-success text-success-foreground shadow-[0_6px_14px_-4px_hsl(var(--success)/0.4)]',
};

const TONE_VALUE: Record<Tone, string> = {
  blue: 'text-primary',
  red: 'text-destructive',
  green: 'text-success',
};

const TONE_DOT: Record<Tone, string> = {
  blue: 'bg-primary',
  red: 'bg-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.15)] animate-pulse',
  green: 'bg-success',
};

// The card whose rentals the table shows right now: ringed from sm up; on
// a phone the whole tile fills with its color instead — a ring around a
// tile a quarter of the screen wide barely reads.
const TONE_ACTIVE: Record<Tone, string> = {
  blue: 'sm:ring-2 sm:ring-primary max-sm:border-primary max-sm:bg-primary max-sm:bg-none max-sm:shadow-[0_10px_22px_-10px_hsl(var(--primary)/0.8)]',
  red: 'sm:ring-2 sm:ring-destructive max-sm:border-destructive max-sm:bg-destructive max-sm:bg-none max-sm:shadow-[0_10px_22px_-10px_hsl(var(--destructive)/0.8)]',
  green: 'sm:ring-2 sm:ring-success max-sm:border-success max-sm:bg-success max-sm:bg-none max-sm:shadow-[0_10px_22px_-10px_hsl(var(--success)/0.8)]',
};

const TONE_STATUS_TEXT: Record<Tone, string> = {
  blue: 'text-muted-foreground',
  red: 'font-semibold text-destructive',
  green: 'font-semibold text-success',
};

// The two "in trouble" counts (retours / remises en retard) are the only
// ones whose tone/icon actually change — everything else about a segment
// is fixed. Zero isn't just "nothing to show": it's an explicitly affirmed
// good state (green, "Aucun retard"), not merely the absence of a red one.
function buildSegments(summary: RentalSummary): Segment[] {
  return [
    {
      label: 'En cours',
      value: summary.active,
      status: 'locations actuellement en cours',
      tone: 'blue',
      icon: ClipboardList,
      filter: { status: 'ACTIVE' },
    },
    {
      label: 'Retours en retard',
      value: summary.overdueReturn,
      status: summary.overdueReturn > 0 ? 'Action requise' : 'Aucun retard',
      tone: summary.overdueReturn > 0 ? 'red' : 'green',
      icon: summary.overdueReturn > 0 ? AlertTriangle : Check,
      filter: { status: 'OVERDUE' },
    },
    {
      label: 'Départs en retard',
      value: summary.overduePickup,
      status: summary.overduePickup > 0 ? 'Action requise' : 'Toutes récupérées',
      tone: summary.overduePickup > 0 ? 'red' : 'green',
      icon: summary.overduePickup > 0 ? KeyRound : Check,
      filter: { status: 'RESERVED', pickupOverdue: true },
    },
    {
      label: 'Réservations à venir',
      value: summary.upcomingReservations,
      status: 'en attente de remise des clés',
      tone: 'blue',
      icon: CalendarClock,
      filter: { status: 'RESERVED', pickupOverdue: false },
    },
  ];
}

function sameFilter(a: CardFilter, b: CardFilter | undefined): boolean {
  return !!b && a.status === b.status && a.pickupOverdue === b.pickupOverdue;
}

type RentalStatusCardsProps = {
  summary: RentalSummary;
  // The table's current filter, so its card shows as selected.
  active?: CardFilter;
  // Filters the table below to just this card's rentals — see
  // RentalsPage's selectStatusFilter, which owns the actual URL/query-param
  // logic; this component only reports which card was clicked.
  onSelect: (filter: CardFilter) => void;
  // Clicking the selected card again: back to every rental.
  onClear: () => void;
};

export function RentalStatusCards({ summary, active, onSelect, onClear }: RentalStatusCardsProps) {
  const segments = buildSegments(summary);

  return (
    // Two by two on phones and tablets, one row on desktop.
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      {segments.map((segment) => {
        const Icon = segment.icon;
        const selected = sameFilter(segment.filter, active);
        return (
          <button
            key={segment.label}
            type="button"
            aria-pressed={selected}
            onClick={() => (selected ? onClear() : onSelect(segment.filter))}
            className={cn(
              'relative grid content-start overflow-hidden rounded-2xl border px-3 pb-3 pt-3.5 text-left transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-2.5 sm:px-4 sm:py-3.5',
              TONE_CARD[segment.tone],
              selected && TONE_ACTIVE[segment.tone],
            )}
          >
            <span
              aria-hidden
              className={cn('absolute inset-x-0 top-0 h-[3px]', TONE_BAR[segment.tone])}
            />
            {/* Oversized, near-invisible icon in the corner — texture, not
                information; purely decorative so it's aria-hidden. */}
            <Icon
              aria-hidden
              className={cn(
                'pointer-events-none absolute -bottom-3 -right-2 hidden h-[72px] w-[72px] -rotate-[8deg] sm:block',
                TONE_WATERMARK[segment.tone],
              )}
            />
            {/* Phone: the icon on the left, the count large beside it and
                the name under the count — two lines at most, min-h keeping
                the four tiles the same height whether a name wraps or not. */}
            <span className="relative flex items-center gap-3 sm:hidden">
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  selected ? 'bg-white/20 text-white' : TONE_ICON_BOX[segment.tone],
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block font-mono text-2xl font-extrabold leading-none tracking-tight tabular-nums',
                    selected ? 'text-white' : TONE_VALUE[segment.tone],
                  )}
                >
                  {segment.value}
                </span>
                <span
                  className={cn(
                    'mt-1 line-clamp-2 min-h-[2lh] text-[10.5px] font-bold uppercase leading-tight tracking-wide',
                    selected ? 'text-white/90' : 'text-muted-foreground',
                  )}
                >
                  {segment.label}
                </span>
              </span>
            </span>

            {/* Icon, name and number on one row — the number pinned right so
                it lines up across the four cards; the name takes what's left
                and wraps (up to two lines) when a 4-column row gets narrow. */}
            <div className="relative flex items-center justify-between gap-3 max-sm:hidden">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
                  TONE_ICON_BOX[segment.tone],
                )}
              >
                <Icon className="h-[17px] w-[17px]" />
              </div>
              <p className="line-clamp-2 min-w-0 flex-1 text-[11.5px] font-bold uppercase leading-tight tracking-wide text-muted-foreground">
                {segment.label}
              </p>
              <p
                className={cn(
                  'shrink-0 font-mono text-[28px] font-extrabold leading-none tracking-tight tabular-nums',
                  TONE_VALUE[segment.tone],
                )}
              >
                {segment.value}
              </p>
            </div>
            <div className="relative hidden min-w-0 items-center gap-1.5 text-xs sm:flex">
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[segment.tone])} />
              <span className={TONE_STATUS_TEXT[segment.tone]}>{segment.status}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
