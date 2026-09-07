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

type RentalStatusCardsProps = {
  summary: RentalSummary;
  // Filters the table below to just this card's rentals — see
  // RentalsPage's selectStatusFilter, which owns the actual URL/query-param
  // logic; this component only reports which card was clicked.
  onSelect: (filter: CardFilter) => void;
};

export function RentalStatusCards({ summary, onSelect }: RentalStatusCardsProps) {
  const segments = buildSegments(summary);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {segments.map((segment) => {
        const Icon = segment.icon;
        return (
          <button
            key={segment.label}
            type="button"
            onClick={() => onSelect(segment.filter)}
            className={cn(
              'relative overflow-hidden rounded-[20px] border p-[22px] text-left transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              TONE_CARD[segment.tone],
            )}
          >
            <span aria-hidden className={cn('absolute inset-x-0 top-0 h-[3px]', TONE_BAR[segment.tone])} />
            {/* Oversized, near-invisible icon in the corner — texture, not
                information; purely decorative so it's aria-hidden. */}
            <Icon
              aria-hidden
              className={cn('pointer-events-none absolute -bottom-4 -right-3 h-24 w-24 -rotate-[8deg]', TONE_WATERMARK[segment.tone])}
            />
            <div
              className={cn(
                'relative mb-4 flex h-[38px] w-[38px] items-center justify-center rounded-xl',
                TONE_ICON_BOX[segment.tone],
              )}
            >
              <Icon className="h-[17px] w-[17px]" />
            </div>
            <p className="relative mb-2 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
              {segment.label}
            </p>
            <p className={cn('relative font-mono text-4xl font-extrabold leading-none tracking-tight', TONE_VALUE[segment.tone])}>
              {segment.value}
            </p>
            <div className="relative mt-3 flex items-center gap-1.5 text-xs">
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[segment.tone])} />
              <span className={TONE_STATUS_TEXT[segment.tone]}>{segment.status}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
