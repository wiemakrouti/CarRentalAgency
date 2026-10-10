import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CircleCheck, HandCoins, Phone } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useFormatMoney } from '@/hooks/use-format-money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Rental } from '@/features/rentals/api/rentals.api';
import type { Balance } from '@/features/rentals/lib/rental-balance';
import { apiDateToLocalDay, toLocalDayOnly } from '@/features/rentals/lib/rental-calendar';

export type ToCollectRow = { rental: Rental; balance: Balance };

type Filter = 'all' | 'active' | 'returned';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// A balance still open this long after the car came back needs chasing.
const STALE_AFTER_DAYS = 30;

type ToCollectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Largest balance first, as the backend sorts them.
  rows: ToCollectRow[];
  onCollect: (row: ToCollectRow) => void;
  onOpenRental: (rentalId: string) => void;
};

function rentalsCount(n: number): string {
  return `${n} location${n > 1 ? 's' : ''}`;
}

function initials(rental: Rental): string {
  return `${rental.client.firstName.charAt(0)}${rental.client.lastName.charAt(0)}`.toUpperCase();
}

function daysSinceReturn(rental: Rental): number | null {
  if (!rental.actualReturnDate) return null;
  const returned = apiDateToLocalDay(rental.actualReturnDate);
  return Math.round((toLocalDayOnly(new Date()).getTime() - returned.getTime()) / MS_PER_DAY);
}

// The detailed list behind the « À encaisser » KPI: a summary of what's
// owed (ongoing vs. already returned), then one row per rental with how
// much of it is already paid and the "Encaisser" action.
export function ToCollectDialog({ open, onOpenChange, rows, onCollect, onOpenRental }: ToCollectDialogProps) {
  const formatMoney = useFormatMoney();
  const [filter, setFilter] = useState<Filter>('all');

  const active = rows.filter((row) => row.rental.status === 'ACTIVE');
  const returned = rows.filter((row) => row.rental.status !== 'ACTIVE');
  const sum = (list: ToCollectRow[]) => list.reduce((total, row) => total + row.balance.remaining, 0);
  const visible = filter === 'active' ? active : filter === 'returned' ? returned : rows;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0">
        <div className="space-y-5 px-6 pb-4 pt-6">
          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground dark:text-warning">
              <HandCoins className="h-5 w-5" />
            </span>
            <div className="space-y-1">
              <DialogTitle>À encaisser</DialogTitle>
              <DialogDescription>
                Loyers non soldés des locations en cours ou rendues depuis moins de 60 jours.
              </DialogDescription>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
            <SummaryTile label="Total dû" value={formatMoney(sum(rows))} detail={rentalsCount(rows.length)} strong />
            <SummaryTile label="En cours" value={formatMoney(sum(active))} detail={rentalsCount(active.length)} />
            <SummaryTile label="Rendues" value={formatMoney(sum(returned))} detail={rentalsCount(returned.length)} />
          </div>

          {rows.length > 0 && (
            <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
              <TabsList>
                <TabsTrigger value="all">Toutes ({rows.length})</TabsTrigger>
                <TabsTrigger value="active">En cours ({active.length})</TabsTrigger>
                <TabsTrigger value="returned">Rendues ({returned.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border px-3 py-2">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <CircleCheck className="h-8 w-8 text-success" />
              <p className="text-sm font-medium">Tout est encaissé</p>
              <p className="text-xs text-muted-foreground">Aucun loyer en attente dans cette catégorie.</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {visible.map((row) => (
                <ToCollectItem
                  key={row.rental.id}
                  row={row}
                  onCollect={() => onCollect(row)}
                  onOpen={() => onOpenRental(row.rental.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-3">
          <p className="text-xs text-muted-foreground">Cliquez sur un client pour ouvrir sa location.</p>
          <Button asChild variant="ghost" size="sm">
            <Link to="/finances" onClick={() => onOpenChange(false)}>
              Voir les finances
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({ label, value, detail, strong }: { label: string; value: string; detail: string; strong?: boolean }) {
  return (
    <div className="space-y-0.5 bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-semibold tabular-nums', strong ? 'text-lg text-foreground' : 'text-base')}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function ToCollectItem({ row, onCollect, onOpen }: { row: ToCollectRow; onCollect: () => void; onOpen: () => void }) {
  const formatMoney = useFormatMoney();
  const { rental, balance } = row;
  const paidPercent = balance.totalDue > 0 ? Math.min((balance.settled / balance.totalDue) * 100, 100) : 0;
  const days = daysSinceReturn(rental);
  const stale = days !== null && days > STALE_AFTER_DAYS;

  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary-700 dark:text-primary">
        {initials(rental)}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="truncate rounded-sm text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {rental.client.firstName} {rental.client.lastName}
          </button>
          {rental.status === 'ACTIVE' ? (
            <Badge variant="success" className="px-2 py-0 text-[10px]">
              En cours
            </Badge>
          ) : (
            <Badge variant={stale ? 'warning' : 'secondary'} className="px-2 py-0 text-[10px]">
              {days === 0 ? 'Rendue aujourd’hui' : `Rendue il y a ${days} j`}
            </Badge>
          )}
        </div>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">
            {rental.car.brand} {rental.car.model} · {rental.car.licensePlate}
          </span>
          <span aria-hidden="true">·</span>
          <a
            href={`tel:${rental.client.phone}`}
            className="inline-flex shrink-0 items-center gap-1 hover:text-foreground hover:underline"
          >
            <Phone className="h-3 w-3" />
            {rental.client.phone}
          </a>
        </p>
      </div>

      <div className="hidden w-32 shrink-0 space-y-1.5 sm:block">
        <p className="text-right text-sm font-semibold tabular-nums">{formatMoney(balance.remaining)}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" title={`Payé ${formatMoney(balance.settled)}`}>
          <div className="h-full rounded-full bg-success" style={{ width: `${paidPercent}%` }} />
        </div>
        <p className="text-right text-[11px] text-muted-foreground tabular-nums">
          sur {formatMoney(balance.totalDue)}
        </p>
      </div>

      <Button size="sm" className="shrink-0" onClick={onCollect}>
        <span className="sm:hidden tabular-nums">{formatMoney(balance.remaining)}</span>
        <span className="hidden sm:inline">Encaisser</span>
      </Button>
    </li>
  );
}
