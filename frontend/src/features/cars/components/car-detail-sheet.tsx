import { useState } from 'react';
import { CalendarDays, ChevronRight, ImageOff, Images, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { MANUALLY_SETTABLE_CAR_STATUSES } from '@car-rental/shared';
import { ExpenseFormDialog } from '@/features/finances/components/expense-form-dialog';
import { useExpensesQuery } from '@/features/finances/hooks/use-expenses';
import { EXPENSE_CATEGORY_LABELS } from '@/features/finances/lib/finance-labels';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiClientError } from '@/lib/api-client';
import type { Car, ManualCarStatus } from '../api/cars.api';
import { useCarQuery, useCarStatsQuery, useUpdateCarStatusMutation } from '../hooks/use-cars';
import {
  formatDocumentStatus,
  getDocumentStatuses,
  type DocumentLevel,
  type ExpiryAlert,
} from '../lib/car-alerts';
import { CarRentedNoticeDialog } from './car-rented-notice-dialog';
import {
  CAR_CATEGORY_LABELS,
  CAR_STATUS_BADGE_VARIANT,
  CAR_STATUS_LABELS,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
} from '../lib/car-labels';

const DOCUMENT_BADGE_VARIANT: Record<DocumentLevel, 'destructive' | 'warning' | 'success' | 'outline'> = {
  expired: 'destructive',
  expiring: 'warning',
  ok: 'success',
  not_set: 'outline',
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

function formatAmount(value: string | number): string {
  return `${Number(value).toLocaleString('fr-TN')} DT`;
}

type CarDetailSheetProps = {
  carId: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManageImages: () => void;
  // Both take the sheet's own freshly-loaded `car` rather than the caller
  // re-deriving it from a paginated/filtered list — a car opened via a
  // notification deep link (CarsPage's openId) may not be on the currently
  // loaded page at all, so looking it up there would silently no-op.
  onEdit: (car: Car, focusField?: ExpiryAlert['field']) => void;
  onOpenCalendar: (car: Car) => void;
};

export function CarDetailSheet({
  carId,
  open,
  onOpenChange,
  onManageImages,
  onEdit,
  onOpenCalendar,
}: CarDetailSheetProps) {
  const [rentedNoticeOpen, setRentedNoticeOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const { data: car, isLoading } = useCarQuery(carId ?? '');
  const { data: stats } = useCarStatsQuery(carId);
  // Most recent first (the backend's own default order) — a compact side
  // panel, not the full Finances ledger, so 5 is plenty; the "au total"
  // count next to the heading covers the rest without a car filter/deep
  // link Finances' own Dépenses tab doesn't support yet.
  const { data: carExpenses } = useExpensesQuery(
    { carId: carId ?? '', pageSize: 5 },
    { enabled: Boolean(carId) },
  );
  const updateStatusMutation = useUpdateCarStatusMutation();

  const primaryImage = car?.images.find((img) => img.isPrimary) ?? car?.images[0];
  const documentStatuses = car ? getDocumentStatuses(car) : [];

  function handleStatusChange(status: ManualCarStatus) {
    if (!carId) return;
    updateStatusMutation.mutate(
      { id: carId, status },
      {
        onSuccess: () => toast.success('Statut mis à jour.'),
        onError: (err) => {
          if (err instanceof ApiClientError && err.code === 'CAR_CURRENTLY_RENTED') {
            toast.warning(err.message);
          } else {
            toast.error(errorMessage(err, 'Erreur lors de la mise à jour du statut.'));
          }
        },
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {isLoading || !car ? (
          <div className="space-y-4 pt-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <>
            <div className="relative -mx-6 -mt-6 h-48 w-[calc(100%+3rem)] overflow-hidden">
              {primaryImage ? (
                <img src={primaryImage.url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-50">
                  <ImageOff className="h-12 w-12 text-primary-200" strokeWidth={1.3} />
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-3 right-3 shadow-sm"
                onClick={onManageImages}
              >
                <Images className="h-4 w-4" />
                Gérer les images
              </Button>
            </div>

            <SheetHeader className="mt-4 flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <SheetTitle>
                  {car.brand} {car.model}
                </SheetTitle>
                <SheetDescription>{car.licensePlate}</SheetDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={() => onEdit(car)}>
                Modifier
              </Button>
            </SheetHeader>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant={CAR_STATUS_BADGE_VARIANT[car.status]}>
                {CAR_STATUS_LABELS[car.status]}
              </Badge>
              {car.status === 'RENTED' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setRentedNoticeOpen(true)}
                >
                  Changer le statut
                </Button>
              ) : (
                <Select
                  value={car.status}
                  onValueChange={(value) => handleStatusChange(value as ManualCarStatus)}
                  disabled={updateStatusMutation.isPending}
                >
                  <SelectTrigger className="h-7 w-44 text-xs">
                    <SelectValue placeholder="Changer le statut..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MANUALLY_SETTABLE_CAR_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {CAR_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {car.activeRental && (
                <span className="text-xs text-muted-foreground">
                  Retour prévu le {formatDate(car.activeRental.plannedReturnDate)}
                </span>
              )}
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Caractéristiques
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Catégorie', CAR_CATEGORY_LABELS[car.category]],
                  ['Transmission', TRANSMISSION_LABELS[car.transmission]],
                  ['Carburant', FUEL_TYPE_LABELS[car.fuelType]],
                  ['Année', String(car.year)],
                  ['Places', `${car.seats} places`],
                  ['Couleur', car.color],
                  ['Kilométrage', `${car.mileage.toLocaleString('fr-TN')} km`, 'col-span-2'],
                ].map(([label, value, span]) => (
                  <div key={label} className={`rounded-xl bg-muted p-3 ${span ?? ''}`}>
                    <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-3.5 text-primary-foreground">
                <div>
                  <p className="text-[11px] font-medium text-primary-100">Tarif journalier</p>
                  <p className="text-xl font-bold">{formatAmount(car.dailyRate)}</p>
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Documents
              </p>
              <ul className="space-y-2">
                {documentStatuses.map((doc) => (
                  <li
                    key={doc.field}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border p-2.5 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{doc.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.date ? `Expire le ${formatDate(doc.date)}` : 'Date non renseignée'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={DOCUMENT_BADGE_VARIANT[doc.level]}>
                        {formatDocumentStatus(doc)}
                      </Badge>
                      {doc.level !== 'ok' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => onEdit(car, doc.field)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          {doc.level === 'not_set' ? 'Renseigner' : 'Renouveler'}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Statistiques
              </p>
              {stats ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Locations au total</dt>
                  <dd>{stats.totalRentals}</dd>
                  <dt className="text-muted-foreground">Locations terminées</dt>
                  <dd>{stats.completedRentals}</dd>
                  <dt className="text-muted-foreground">Revenu encaissé</dt>
                  <dd>{formatAmount(stats.totalRevenue)}</dd>
                  <dt className="text-muted-foreground">Dernière location</dt>
                  <dd>{stats.lastRentalDate ? formatDate(stats.lastRentalDate) : '—'}</dd>
                </dl>
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Dépenses
                </p>
                <div className="flex items-center gap-2">
                  {carExpenses && carExpenses.meta.total > carExpenses.items.length && (
                    <span className="text-xs text-muted-foreground">{carExpenses.meta.total} au total</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => setExpenseFormOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Ajouter
                  </Button>
                </div>
              </div>
              {!carExpenses ? (
                <Skeleton className="h-16 w-full" />
              ) : carExpenses.items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  Aucune dépense enregistrée pour cette voiture.
                </p>
              ) : (
                <ul className="space-y-2">
                  {carExpenses.items.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border p-2.5 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{EXPENSE_CATEGORY_LABELS[expense.category]}</p>
                        <p className="truncate text-xs text-muted-foreground">{expense.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-semibold text-foreground">{formatAmount(expense.amount)}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(expense.date)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Separator className="my-4" />

            <Button variant="outline" className="w-full justify-between" onClick={() => onOpenCalendar(car)}>
              <span className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Calendrier et historique des locations
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          </>
        )}
      </SheetContent>

      <CarRentedNoticeDialog
        open={rentedNoticeOpen}
        onOpenChange={setRentedNoticeOpen}
        carId={carId ?? ''}
      />

      {/* Mounted only while open, not toggled via a persistent instance —
          guarantees defaultCarId is always this sheet's current car, not a
          stale value left over from react-hook-form's own defaultValues
          being fixed at first mount. */}
      {expenseFormOpen && carId && (
        <ExpenseFormDialog open={expenseFormOpen} onOpenChange={setExpenseFormOpen} defaultCarId={carId} />
      )}
    </Sheet>
  );
}

