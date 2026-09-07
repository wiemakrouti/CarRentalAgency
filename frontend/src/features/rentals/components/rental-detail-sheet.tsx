import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PaymentType } from '@car-rental/shared';
import {
  CalendarPlus,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Fuel,
  Gauge,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

import type { Rental } from '../api/rentals.api';
import { useRentalQuery } from '../hooks/use-rentals';
import {
  getDisplayRentalStatusSummary,
  getEffectiveRentalStatus,
  toLocalDayOnly,
  type DisplayRentalStatus,
} from '../lib/rental-calendar';
import { DISPLAY_RENTAL_STATUS_LABELS } from '../lib/rental-labels';
import { BALANCE_BADGE_VARIANT, BALANCE_LABELS, buildBalance, depositCollectedAmount } from '../lib/rental-balance';
import type { Payment } from '@/features/finances/api/finances.api';
import { PaymentFormDialog } from '@/features/finances/components/payment-form-dialog';
import { PaymentSettleDialog } from '@/features/finances/components/payment-settle-dialog';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_BADGE_VARIANT,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from '@/features/finances/lib/finance-labels';
import { ActivateRentalDialog } from './activate-rental-dialog';
import { CancelRentalDialog } from './cancel-rental-dialog';
import { ReturnRentalDialog } from './return-rental-dialog';
import { ExtendRentalDialog } from './extend-rental-dialog';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN', { day: '2-digit', month: '2-digit' });
}

function formatAmount(value: string | number): string {
  return `${Number(value).toLocaleString('fr-TN')} DT`;
}

// Whole calendar days between two dates — for a duration or a countdown
// ("dans 3 j"), never for an "is this late" judgment (use daysPast below):
// truncating both sides to their local day first means the result is always
// an exact day count, not skewed by whatever time-of-day each Date carries.
function daysUntil(from: Date, to: Date): number {
  return Math.round((toLocalDayOnly(to).getTime() - toLocalDayOnly(from).getTime()) / MS_PER_DAY);
}

// Full calendar days a scheduled date (plannedReturnDate or pickupDate) has
// been passed by `to` — exactly mirrors RentalsService.returnRental's own
// late-fee day count (backend/src/lib/date-utils.ts's startOfDay): 0 on the
// scheduled day itself, not 1. Both sides get truncated, not just `to` —
// scheduledDate is a UTC-midnight value (see rental-calendar.ts's own
// comment on this), which for any positive UTC offset (Tunisia is UTC+1) is
// an hour or more *after* local midnight, not local midnight itself. Skipping
// its truncation silently subtracted that offset from every count, rounding
// a clean N-day gap down to N-1 every single time. Used both for a live "if
// closed/activated right now" estimate (to=now) and an already-closed
// rental's actual lateness (to=actualReturnDate), so the preview and the history
// never disagree with what was actually billed.
function daysPast(scheduledDate: Date, to: Date): number {
  return Math.max(0, Math.floor((toLocalDayOnly(to).getTime() - toLocalDayOnly(scheduledDate).getTime()) / MS_PER_DAY));
}

// Balance/deposit-collected logic lives in rental-balance.ts — shared with
// the Rentals table's own "Paiement" column, so the two views can never
// quietly disagree about what "Soldé" means.

// The stamp is a status pill styled like a rubber-stamp mark on a paper
// ticket — every status keeps the same frosted-glass treatment, just tinted
// per RENTAL_STATUS_BADGE_VARIANT's own semantics, so it reads consistently
// with the badge shown everywhere else (table, calendars) without clashing
// against the gradient it sits on. Keyed by DisplayRentalStatus (not plain
// RentalStatus) so a RESERVED rental whose pickup never happened gets its
// own tint instead of silently reading as a plain, on-schedule "Réservée".
const STAMP_TONE: Record<DisplayRentalStatus, string> = {
  RESERVED: 'border-white/70 text-white',
  ACTIVE: 'border-white/70 text-white',
  OVERDUE: 'border-amber-200 text-amber-100',
  PICKUP_OVERDUE: 'border-amber-200 text-amber-100',
  COMPLETED: 'border-white/50 text-white/85',
  CANCELLED: 'border-red-200 text-red-100',
  EXTENDED: 'border-white/70 text-white',
};

type TimelineNodeTone = 'done' | 'pending' | 'late' | 'muted';
type TimelineNode = { label: string; value: string; tone: TimelineNodeTone };
type TimelineConnectorTone = 'done' | 'pending' | 'late' | 'muted';
type TimelineCallout = { value: string; text: string; tone: 'crit' | 'info' } | null;

const NODE_DOT_CLASSES: Record<TimelineNodeTone, string> = {
  done: 'bg-primary-500 shadow-[0_0_0_3px_hsl(var(--primary-100))]',
  pending: 'bg-transparent border-2 border-muted-foreground/40',
  late: 'bg-destructive shadow-[0_0_0_3px_hsl(var(--destructive)/0.18)] animate-pulse',
  muted: 'bg-muted-foreground/30',
};

const NODE_VALUE_CLASSES: Record<TimelineNodeTone, string> = {
  done: 'text-foreground',
  pending: 'text-muted-foreground',
  late: 'text-destructive',
  muted: 'text-muted-foreground line-through',
};

const CONNECTOR_CLASSES: Record<TimelineConnectorTone, string> = {
  done: 'border-primary-300',
  pending: 'border-border',
  late: 'border-destructive/50',
  muted: 'border-border',
};

// Builds the frise's nodes/connectors/callout for every state a rental can
// be in — never a stored "OVERDUE" on rental.status itself (see
// rental-calendar.ts), so this branches on the same computed
// getEffectiveRentalStatus everything else in the app uses, plus the
// pickup-overdue case (RESERVED past its pickupDate — the
// RENTAL_PICKUP_OVERDUE reminder's own condition) which effective status
// alone doesn't capture.
function buildTimeline(
  rental: Rental,
  now: Date,
): { nodes: TimelineNode[]; connectors: TimelineConnectorTone[]; callout: TimelineCallout } {
  const pickup = new Date(rental.pickupDate);
  const plannedReturn = new Date(rental.plannedReturnDate);
  const actualReturn = rental.actualReturnDate ? new Date(rental.actualReturnDate) : null;
  const effectiveStatus = getEffectiveRentalStatus(rental, now);

  if (rental.status === 'CANCELLED') {
    return {
      nodes: [
        { label: 'Départ', value: formatShortDate(rental.pickupDate), tone: 'muted' },
        { label: 'Retour prévu', value: formatShortDate(rental.plannedReturnDate), tone: 'muted' },
      ],
      connectors: ['muted'],
      callout: null,
    };
  }

  if (actualReturn) {
    const lateDays = daysPast(plannedReturn, actualReturn);
    return {
      nodes: [
        { label: 'Départ', value: formatShortDate(rental.pickupDate), tone: 'done' },
        { label: 'Retour prévu', value: formatShortDate(rental.plannedReturnDate), tone: 'done' },
        { label: 'Retour effectif', value: formatShortDate(rental.actualReturnDate!), tone: 'done' },
      ],
      connectors: ['done', lateDays > 0 ? 'late' : 'done'],
      callout:
        lateDays > 0
          ? { value: `+${lateDays}`, text: `jour${lateDays > 1 ? 's' : ''} de retard au retour`, tone: 'info' }
          : null,
    };
  }

  if (effectiveStatus === 'OVERDUE') {
    const lateDays = daysPast(plannedReturn, now);
    return {
      nodes: [
        { label: 'Départ', value: formatShortDate(rental.pickupDate), tone: 'done' },
        { label: 'Retour prévu', value: formatShortDate(rental.plannedReturnDate), tone: 'done' },
        { label: "Aujourd'hui", value: formatShortDate(now.toISOString()), tone: 'late' },
      ],
      connectors: ['done', 'late'],
      callout: { value: String(lateDays), text: `jour${lateDays > 1 ? 's' : ''} de retard sur le retour`, tone: 'crit' },
    };
  }

  // Compared by calendar day — a pickup scheduled for today isn't missed
  // until today is over (getEffectiveRentalStatus/getDisplayRentalStatus in
  // rental-calendar.ts apply this same boundary for the table/calendar).
  if (rental.status === 'RESERVED' && toLocalDayOnly(pickup).getTime() < toLocalDayOnly(now).getTime()) {
    const lateDays = daysPast(pickup, now);
    return {
      nodes: [
        { label: 'Départ prévu', value: formatShortDate(rental.pickupDate), tone: 'late' },
        { label: 'Retour prévu', value: formatShortDate(rental.plannedReturnDate), tone: 'pending' },
      ],
      connectors: ['late'],
      callout: { value: String(lateDays), text: `jour${lateDays > 1 ? 's' : ''} de retard sur le départ`, tone: 'crit' },
    };
  }

  // RESERVED (not yet due) or ACTIVE within its planned window.
  return {
    nodes: [
      { label: 'Départ', value: formatShortDate(rental.pickupDate), tone: rental.status === 'ACTIVE' ? 'done' : 'pending' },
      { label: 'Retour prévu', value: formatShortDate(rental.plannedReturnDate), tone: 'pending' },
    ],
    connectors: [rental.status === 'ACTIVE' ? 'done' : 'pending'],
    callout: null,
  };
}

type KpiTone = 'accent' | 'warn' | 'crit' | 'muted' | 'success';

const KPI_CLASSES: Record<KpiTone, string> = {
  accent: 'bg-primary-50 border-primary-100 dark:bg-primary/10 dark:border-primary/20',
  warn: 'bg-warning/10 border-warning/30',
  crit: 'bg-destructive/10 border-destructive/30',
  muted: 'bg-muted border-border',
  success: 'bg-success/10 border-success/30',
};

const KPI_VALUE_CLASSES: Record<KpiTone, string> = {
  accent: 'text-primary-700 dark:text-primary-300',
  success: 'text-success',
  warn: 'text-warning',
  crit: 'text-destructive',
  muted: 'text-muted-foreground',
};

// The third KPI tile is the one number that changes meaning with the
// rental's situation — everywhere else (Total/Caution) stays put. Keeping
// this next to buildTimeline above so the two pieces of "what's the
// situation" logic don't drift apart.
type ThirdKpi = { label: string; value: string; sub: string; tone: KpiTone; feeEstimate?: string };

function buildThirdKpi(rental: Rental, now: Date): ThirdKpi | null {
  const pickup = new Date(rental.pickupDate);
  const plannedReturn = new Date(rental.plannedReturnDate);
  const effectiveStatus = getEffectiveRentalStatus(rental, now);

  if (rental.status === 'CANCELLED') return null;

  if (rental.actualReturnDate) {
    const actualReturn = new Date(rental.actualReturnDate);
    const duration = Math.max(0, daysUntil(pickup, actualReturn));
    const lateDays = daysPast(plannedReturn, actualReturn);
    return {
      label: 'Durée',
      value: `${duration} j`,
      sub: lateDays > 0 ? `+${lateDays} j vs prévu` : 'Rendue à temps',
      tone: lateDays > 0 ? 'warn' : 'accent',
    };
  }

  if (effectiveStatus === 'OVERDUE') {
    const lateDays = daysPast(plannedReturn, now);
    // Same formula as RentalsService.returnRental's own late-fee calculation
    // — a live preview of what would actually be billed if closed right
    // now, not just "how many days" (rentals.service.ts's own lateDays *
    // dailyRate), so the admin knows the number before quoting the client
    // on the phone instead of only discovering it after clôturing.
    const feeEstimate = lateDays * Number(rental.dailyRate);
    return {
      label: 'Retard',
      value: `${lateDays} j`,
      sub: `Depuis le ${formatDate(rental.plannedReturnDate)}`,
      tone: 'crit',
      feeEstimate: formatAmount(feeEstimate),
    };
  }

  // Compared by calendar day — see buildTimeline's own identical check above.
  if (rental.status === 'RESERVED' && toLocalDayOnly(pickup).getTime() < toLocalDayOnly(now).getTime()) {
    const lateDays = daysPast(pickup, now);
    return { label: 'Retard départ', value: `${lateDays} j`, sub: 'Non récupérée', tone: 'crit' };
  }

  if (rental.status === 'RESERVED') {
    const days = Math.max(0, daysUntil(now, pickup));
    return { label: 'Avant remise', value: days === 0 ? "Aujourd'hui" : `${days} j`, sub: `Prévue le ${formatDate(rental.pickupDate)}`, tone: 'accent' };
  }

  // ACTIVE, within its planned window.
  const days = Math.max(0, daysUntil(now, plannedReturn));
  return { label: 'Jours restants', value: days === 0 ? "Aujourd'hui" : `${days} j`, sub: `Retour prévu le ${formatDate(rental.plannedReturnDate)}`, tone: 'accent' };
}

type RentalDetailSheetProps = {
  rentalId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Redesigned as a "rental ticket" rather than a flat field list: a
// boarding-pass-style stub up top, a die-cut divider, a frise standing in
// for the old Départ/Retour box grid, and KPI tiles for the numbers that
// matter most. Actions (activate/return/extend/cancel) open the exact same
// dialogs RentalRowActions uses in the table — promoted here to full-width
// buttons pinned under the scrollable body instead of a dropdown, but never
// a second copy of the mutation logic itself, so behavior can't drift
// between "acting from the row" and "acting from the sheet".
export function RentalDetailSheet({ rentalId, open, onOpenChange }: RentalDetailSheetProps) {
  const { data: rental, isLoading } = useRentalQuery(rentalId ?? '');
  const [activateOpen, setActivateOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  // Same PaymentFormDialog/PaymentSettleDialog as the Finances module — the
  // rental is just handing off to them (rentalId preset, no rental search
  // needed) rather than duplicating payment-entry logic here. paymentPreset
  // seeds type/amount for a quick action (Caution tile's Encaisser/
  // Rembourser) — null for the plain "+ Ajouter" entry point.
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [paymentPreset, setPaymentPreset] = useState<{ type: PaymentType; amount: number } | null>(null);
  const [settlingPayment, setSettlingPayment] = useState<Payment | null>(null);

  function openPaymentForm(preset: { type: PaymentType; amount: number } | null) {
    setPaymentPreset(preset);
    setPaymentFormOpen(true);
  }

  const now = new Date();
  // The stamp's own status — a superset of getEffectiveRentalStatus (used
  // by buildTimeline/buildThirdKpi below) that also catches a RESERVED
  // rental whose pickup never happened, so the stamp doesn't disagree with
  // the frise/KPI tile sitting right underneath it about whether there's a
  // problem.
  const displayStatus = rental ? getDisplayRentalStatusSummary(rental, now) : null;
  const timeline = rental ? buildTimeline(rental, now) : null;
  const thirdKpi = rental ? buildThirdKpi(rental, now) : null;
  const hasMileage = rental && (rental.mileageAtPickup !== null || rental.mileageAtReturn !== null);
  // A cancelled reservation never earns a rental fee — nothing to settle,
  // and any deposit already paid is its own concern (see CancelRentalDialog's
  // own warning), not this balance.
  const balance = rental && rental.status !== 'CANCELLED' ? buildBalance(rental) : null;
  const depositExpected = rental ? Number(rental.depositAmount) : 0;
  const depositCollected = rental ? depositCollectedAmount(rental) : 0;
  // Refunding only makes sense once the rental has actually run its course
  // — mid-rental (RESERVED/ACTIVE) there's nothing to hand back yet.
  const canRefundDeposit = Boolean(
    rental &&
      depositCollected > 0 &&
      !rental.depositReturned &&
      (rental.status === 'COMPLETED' || rental.status === 'CANCELLED'),
  );
  // The plain "+ Ajouter" entry point (unlike the Caution tile's own
  // dedicated buttons) has no single obvious payment in mind — but it can
  // still guess the one thing most likely wanted: whatever's actually
  // outstanding right now. Same "prefill, don't force" spirit as the
  // Nouvelle location form's own "Encaisser un paiement maintenant".
  const defaultAddPaymentPreset: { type: PaymentType; amount: number } | null =
    balance && balance.remaining > 0
      ? { type: 'RENTAL_PAYMENT', amount: balance.remaining }
      : depositExpected > depositCollected
        ? { type: 'DEPOSIT', amount: depositExpected - depositCollected }
        : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" showCloseButton={false} className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {isLoading || !rental || !timeline || !displayStatus ? (
          <div className="space-y-4 p-6 pt-10">
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            {/* overflow-x-hidden: the perforation's die-cut notches and the
                stub's corner glow are deliberately positioned a few px past
                the panel's edges — without this, that turns into a real
                (if tiny) horizontal scrollbar instead of just clipping. */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              {/* --- Stub: gradient hero styled like a boarding-pass ticket --- */}
              <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 px-6 pb-6 pt-6 text-primary-foreground">
                <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                <div className="relative">
                  <SheetHeader className="items-start gap-1 space-y-0 text-left">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary-100">Location</p>
                    <SheetTitle className="font-mono text-2xl tracking-tight text-primary-foreground">
                      {rental.rentalNumber}
                    </SheetTitle>
                    <SheetDescription className="text-primary-100">
                      Créée le {formatDate(rental.createdAt)}
                    </SheetDescription>
                  </SheetHeader>
                </div>

                <div className="relative mt-3 flex justify-end">
                  <span
                    className={cn(
                      'inline-block -rotate-6 rounded-lg border-2 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider',
                      STAMP_TONE[displayStatus],
                    )}
                  >
                    {DISPLAY_RENTAL_STATUS_LABELS[displayStatus]}
                  </span>
                </div>

                <div className="relative mt-4 grid grid-cols-2 gap-2.5">
                  <Link
                    to={`/cars?openId=${rental.car.id}`}
                    className="group flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 p-3 transition-colors hover:bg-white/20"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <CarFront className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {rental.car.brand} {rental.car.model}
                      </span>
                      <span className="block font-mono text-[11px] text-primary-100">{rental.car.licensePlate}</span>
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
                  </Link>
                  <Link
                    to={`/clients?openId=${rental.client.id}`}
                    className="group flex items-center gap-2.5 rounded-2xl border border-white/15 bg-white/10 p-3 transition-colors hover:bg-white/20"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                      <Users className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {rental.client.firstName} {rental.client.lastName}
                      </span>
                      <span className="block font-mono text-[11px] text-primary-100">{rental.client.phone}</span>
                    </span>
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" />
                  </Link>
                </div>
              </div>

              {/* --- Perforation: die-cut tear line between the stub and the detail --- */}
              <div className="relative border-t-2 border-dashed border-border" aria-hidden>
                <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-background" />
                <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-background" />
              </div>

              <div className="space-y-7 px-6 py-6">
                {/* --- Frise (timeline) --- */}
                <div>
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Frise</p>
                  <div className="flex items-start">
                    {timeline.nodes.map((node, i) => {
                      // i > 0 guarantees this index is in bounds (connectors
                      // has nodes.length - 1 entries) — the `?? 'muted'`
                      // only satisfies noUncheckedIndexedAccess, it never
                      // actually applies at runtime.
                      const connectorTone = timeline.connectors[i - 1] ?? 'muted';
                      return (
                      <div className="contents" key={node.label}>
                        {i > 0 && (
                          <div
                            className={cn(
                              'mt-[7px] h-0 flex-1 border-t-2',
                              connectorTone === 'late' || connectorTone === 'pending' ? 'border-dashed' : 'border-solid',
                              CONNECTOR_CLASSES[connectorTone],
                            )}
                          />
                        )}
                        <div className="flex w-24 shrink-0 flex-col items-center text-center">
                          <span className={cn('h-4 w-4 rounded-full', NODE_DOT_CLASSES[node.tone])} />
                          <span className="mt-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {node.label}
                          </span>
                          <span className={cn('mt-0.5 font-mono text-[13px] font-semibold', NODE_VALUE_CLASSES[node.tone])}>
                            {node.value}
                          </span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                  {timeline.callout && (
                    <div
                      className={cn(
                        'mt-4 flex items-center gap-3 rounded-xl border p-3',
                        timeline.callout.tone === 'crit'
                          ? 'border-destructive bg-destructive/10 text-destructive'
                          : 'border-warning bg-warning/10 text-warning',
                      )}
                    >
                      <span className="font-mono text-xl font-extrabold">{timeline.callout.value}</span>
                      <span className="text-xs font-semibold leading-tight">{timeline.callout.text}</span>
                    </div>
                  )}
                </div>

                {/* --- KPI tiles --- */}
                <div>
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Montants</p>
                  <div className={cn('grid gap-2.5', thirdKpi ? 'grid-cols-3' : 'grid-cols-2')}>
                    <div className={cn('rounded-2xl border p-3.5', KPI_CLASSES.accent)}>
                      <p className="text-[11px] font-medium text-muted-foreground">Total</p>
                      <p className={cn('font-mono text-lg font-bold', KPI_VALUE_CLASSES.accent)}>
                        {formatAmount(rental.totalAmount)}
                      </p>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">{formatAmount(rental.dailyRate)} / jour</p>
                    </div>
                    {/* Restituée reads as a resolved/positive state, still
                        held reads as pending — same success/warn split the
                        rest of the app uses, not a fixed color regardless
                        of status. */}
                    <div
                      className={cn(
                        'rounded-2xl border p-3.5',
                        KPI_CLASSES[rental.depositReturned ? 'success' : 'warn'],
                      )}
                    >
                      <p className={cn('text-[11px] font-medium', KPI_VALUE_CLASSES[rental.depositReturned ? 'success' : 'warn'])}>
                        Caution
                      </p>
                      <p
                        className={cn(
                          'font-mono text-lg font-bold',
                          KPI_VALUE_CLASSES[rental.depositReturned ? 'success' : 'warn'],
                        )}
                      >
                        {formatAmount(rental.depositAmount)}
                      </p>
                      <p
                        className={cn(
                          'mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold',
                          KPI_VALUE_CLASSES[rental.depositReturned ? 'success' : 'warn'],
                        )}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        {rental.depositReturned
                          ? 'Restituée'
                          : depositExpected <= 0
                            ? 'Aucune caution'
                            : depositCollected <= 0
                              ? 'À encaisser'
                              : 'Non restituée'}
                      </p>
                      {/* depositAmount/depositReturned only ever say what's
                          expected and whether it's been handed back — the
                          buttons below are the two moments that actually
                          change the real payments ledger (see
                          depositCollectedAmount and PaymentsService.create's
                          DEPOSIT_REFUND ↔ depositReturned sync). */}
                      {!rental.depositReturned && depositExpected > 0 && depositCollected <= 0 && (
                        <button
                          type="button"
                          onClick={() => openPaymentForm({ type: 'DEPOSIT', amount: depositExpected })}
                          className="mt-1.5 text-[10.5px] font-semibold text-warning underline-offset-2 hover:underline"
                        >
                          Encaisser la caution
                        </button>
                      )}
                      {canRefundDeposit && (
                        <button
                          type="button"
                          onClick={() => openPaymentForm({ type: 'DEPOSIT_REFUND', amount: depositCollected })}
                          className="mt-1.5 text-[10.5px] font-semibold text-warning underline-offset-2 hover:underline"
                        >
                          Rembourser la caution
                        </button>
                      )}
                    </div>
                    {thirdKpi && (
                      <div className={cn('rounded-2xl border p-3.5', KPI_CLASSES[thirdKpi.tone])}>
                        <p className={cn('text-[11px] font-medium', KPI_VALUE_CLASSES[thirdKpi.tone])}>{thirdKpi.label}</p>
                        <p className={cn('font-mono text-lg font-bold', KPI_VALUE_CLASSES[thirdKpi.tone])}>{thirdKpi.value}</p>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">{thirdKpi.sub}</p>
                        {/* Live preview of what Clôturer would actually
                            bill right now (same formula as
                            RentalsService.returnRental) — so the admin
                            knows the number before quoting the client on
                            the phone, not only after closing the rental. */}
                        {thirdKpi.feeEstimate && (
                          <p className={cn('mt-1 font-mono text-[11px] font-bold', KPI_VALUE_CLASSES[thirdKpi.tone])}>
                            ~{thirdKpi.feeEstimate} estimés
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stacked, not side-by-side: Paiements always sits directly
                    under Kilométrage (never sharing a row with it), so it
                    reads as the next section down regardless of whether
                    Kilométrage itself is even rendered. */}
                {hasMileage && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Gauge className="h-3.5 w-3.5" />
                      Kilométrage
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-[10.5px] font-medium text-muted-foreground">Au départ</p>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {rental.mileageAtPickup !== null ? `${rental.mileageAtPickup.toLocaleString('fr-TN')} km` : '—'}
                        </p>
                        {rental.fuelLevelAtPickup && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Fuel className="h-3 w-3" />
                            {rental.fuelLevelAtPickup}
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl bg-muted p-3">
                        <p className="text-[10.5px] font-medium text-muted-foreground">Au retour</p>
                        <p className="font-mono text-sm font-semibold text-foreground">
                          {rental.mileageAtReturn !== null ? `${rental.mileageAtReturn.toLocaleString('fr-TN')} km` : '—'}
                        </p>
                        {rental.fuelLevelAtReturn && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Fuel className="h-3 w-3" />
                            {rental.fuelLevelAtReturn}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <Wallet className="h-3.5 w-3.5" />
                        Paiements
                      </p>
                      {balance && (
                        <Badge variant={BALANCE_BADGE_VARIANT[balance.status]}>
                          {BALANCE_LABELS[balance.status]}
                        </Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => openPaymentForm(defaultAddPaymentPreset)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Ajouter
                    </button>
                  </div>

                  {balance && (
                    <div className="mb-3 grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/30 text-center">
                      <div className="px-2 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Total dû
                        </p>
                        <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                          {formatAmount(balance.totalDue)}
                        </p>
                      </div>
                      <div className="px-2 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Réglé
                        </p>
                        <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                          {formatAmount(balance.settled)}
                        </p>
                      </div>
                      <div className="px-2 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          Reste
                        </p>
                        <p
                          className={cn(
                            'font-mono text-sm font-extrabold tabular-nums',
                            balance.status === 'UNPAID' && 'text-destructive',
                            balance.status === 'PARTIAL' && 'text-warning',
                          )}
                        >
                          {formatAmount(Math.max(balance.remaining, 0))}
                        </p>
                      </div>
                    </div>
                  )}

                  {rental.payments.length === 0 ? (
                    <div className="space-y-2 rounded-xl border border-dashed border-border p-4 text-center">
                      <p className="text-xs text-muted-foreground">Aucun paiement enregistré.</p>
                      <button
                        type="button"
                        onClick={() => openPaymentForm(defaultAddPaymentPreset)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Ajouter un paiement
                      </button>
                    </div>
                  ) : (
                    <ul>
                      {rental.payments.map((payment) => (
                        <li key={payment.id}>
                          <button
                            type="button"
                            onClick={() => setSettlingPayment(payment)}
                            className="-mx-1 flex w-full items-baseline gap-2 rounded-lg border-b border-dotted border-border px-1 py-2.5 text-left transition-colors last:border-0 hover:bg-muted/60"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground" title={PAYMENT_TYPE_LABELS[payment.type]}>
                                {PAYMENT_TYPE_LABELS[payment.type]}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {PAYMENT_METHOD_LABELS[payment.method]}
                                {payment.paidAt ? ` · ${formatDate(payment.paidAt)}` : ''}
                              </p>
                            </div>
                            <span aria-hidden className="mx-1 h-0 flex-1 translate-y-[-4px] border-b border-dotted border-border" />
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                                {formatAmount(payment.amount)}
                              </span>
                              <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[payment.status]}>
                                {PAYMENT_STATUS_LABELS[payment.status]}
                              </Badge>
                              <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {rental.extensions.length > 0 && (
                  <div>
                    <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Prolongations
                    </p>
                    <ul className="space-y-2">
                      {rental.extensions.map((ext) => (
                        <li
                          key={ext.id}
                          className="flex items-center justify-between rounded-xl border border-border p-2.5 text-sm"
                        >
                          <span className="font-mono text-xs">
                            {formatShortDate(ext.previousReturnDate)} → {formatShortDate(ext.newReturnDate)}
                          </span>
                          <span className="font-mono text-sm font-semibold text-foreground">
                            {formatAmount(ext.additionalAmount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {rental.cancelledReason && (
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <XCircle className="h-3.5 w-3.5" />
                        Motif d'annulation
                      </p>
                      <p className="rounded-r-lg border-l-2 border-destructive bg-destructive/5 py-2 pl-3 text-sm italic text-foreground">
                        {rental.cancelledReason}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* --- Sticky action bar: the same lifecycle actions
                RentalRowActions puts behind a "..." menu in the table,
                promoted here to always-visible buttons. --- */}
            {rental.status === 'RESERVED' && (
              <div className="flex shrink-0 gap-2.5 border-t border-border bg-card px-6 py-4">
                <button
                  type="button"
                  onClick={() => setActivateOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-600 active:scale-[0.98]"
                >
                  <KeyRound className="h-4 w-4" />
                  Activer
                </button>
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-destructive/40 px-4 py-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 active:scale-[0.98]"
                >
                  <XCircle className="h-4 w-4" />
                  Annuler
                </button>
              </div>
            )}
            {rental.status === 'ACTIVE' && (
              <div className="flex shrink-0 gap-2.5 border-t border-border bg-card px-6 py-4">
                <button
                  type="button"
                  onClick={() => setReturnOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-600 active:scale-[0.98]"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Clôturer
                </button>
                <button
                  type="button"
                  onClick={() => setExtendOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Prolonger
                </button>
              </div>
            )}

            <ActivateRentalDialog open={activateOpen} onOpenChange={setActivateOpen} rental={rental} />
            <CancelRentalDialog open={cancelOpen} onOpenChange={setCancelOpen} rental={rental} />
            <ReturnRentalDialog open={returnOpen} onOpenChange={setReturnOpen} rental={rental} />
            <ExtendRentalDialog open={extendOpen} onOpenChange={setExtendOpen} rental={rental} />
            <PaymentFormDialog
              open={paymentFormOpen}
              onOpenChange={setPaymentFormOpen}
              rentalId={rental.id}
              defaultType={paymentPreset?.type}
              defaultAmount={paymentPreset?.amount}
            />
            {settlingPayment && (
              <PaymentSettleDialog
                open={Boolean(settlingPayment)}
                onOpenChange={(next) => {
                  if (!next) setSettlingPayment(null);
                }}
                payment={settlingPayment}
              />
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
