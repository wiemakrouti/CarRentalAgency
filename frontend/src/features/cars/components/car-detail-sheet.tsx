import { useState } from 'react';
import { CalendarDays, ChevronRight, ImageOff, Images, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { MANUALLY_SETTABLE_CAR_STATUSES } from '@car-rental/shared';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
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
import { useFormatMoney } from '@/hooks/use-format-money';
import type { Car, ManualCarStatus } from '../api/cars.api';
import {
  useCarProfitabilityQuery,
  useCarQuery,
  useCarStatsQuery,
  useUpdateCarStatusMutation,
} from '../hooks/use-cars';
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
  const [outOfServiceConfirmOpen, setOutOfServiceConfirmOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const formatMoney = useFormatMoney();
  const formatAmount = (value: string | number) => formatMoney(Number(value));
  const { data: car, isLoading } = useCarQuery(carId ?? '');
  const { data: stats } = useCarStatsQuery(carId);
  const { data: profitability } = useCarProfitabilityQuery(carId, car?.status === 'OUT_OF_SERVICE');
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
  // Worst-first: expired beats expiring beats never-entered — undefined
  // once every document is 'ok', which hides the section's single "Mettre
  // à jour" button entirely (see below).
  const worstDocument =
    documentStatuses.find((d) => d.level === 'expired') ??
    documentStatuses.find((d) => d.level === 'expiring') ??
    documentStatuses.find((d) => d.level === 'not_set');

  function handleStatusChange(status: ManualCarStatus) {
    if (!carId) return;
    updateStatusMutation.mutate(
      { id: carId, status },
      {
        onSuccess: () => toast.success('Statut mis à jour.'),
        onError: (err) => {
          if (
            err instanceof ApiClientError &&
            (err.code === 'CAR_CURRENTLY_RENTED' || err.code === 'CAR_OUT_OF_SERVICE')
          ) {
            toast.warning(err.message);
          } else {
            toast.error(errorMessage(err, 'Erreur lors de la mise à jour du statut.'));
          }
        },
      },
    );
  }

  // OUT_OF_SERVICE means sold/retired for good — the backend then refuses
  // any further status change (see CarsService.update), so this is a
  // one-way door. Routed through a confirmation instead of applying
  // immediately like the other two manually-settable statuses.
  function handleSelectStatus(status: ManualCarStatus) {
    if (status === 'OUT_OF_SERVICE') {
      setOutOfServiceConfirmOpen(true);
    } else {
      handleStatusChange(status);
    }
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
              ) : car.status === 'OUT_OF_SERVICE' ? null : (
                <Select
                  value={car.status}
                  onValueChange={(value) => handleSelectStatus(value as ManualCarStatus)}
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

            {/* A retired (sold) car's papers will never be renewed by this
                agency again, so this section — like the table/grid badge
                and the reminders it would otherwise generate — has nothing
                actionable to show once the car is OUT_OF_SERVICE. */}
            {car.status !== 'OUT_OF_SERVICE' && (
              <>
                <Separator className="my-4" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Documents
                    </p>
                    {/* One button for the whole section, not one per document —
                        all three expiry fields sit together in the edit form
                        (car-form-dialog.tsx), so fixing the worst one lands the
                        admin right next to the other two as well. Worst-first:
                        expired beats expiring beats never-entered, same
                        priority car-alerts.ts's own summary uses; hidden
                        entirely once nothing needs attention. */}
                    {worstDocument && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => onEdit(car, worstDocument.field)}
                      >
                        <RefreshCw className="h-3 w-3" />
                        Mettre à jour
                      </Button>
                    )}
                  </div>
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
                        <Badge variant={DOCUMENT_BADGE_VARIANT[doc.level]}>
                          {formatDocumentStatus(doc)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            <Separator className="my-4" />

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Statistiques
              </p>
              {stats ? (
                <>
                  {/* Same tile/highlight pattern as Caractéristiques above —
                      that section was the only one in this sheet styled as
                      a plain <dl>, the one visible inconsistency in an
                      otherwise tile-based panel. */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-[11px] font-medium text-muted-foreground">Locations au total</p>
                      <p className="text-sm font-semibold text-foreground">{stats.totalRentals}</p>
                    </div>
                    <div className="rounded-xl bg-muted p-3">
                      <p className="text-[11px] font-medium text-muted-foreground">Terminées</p>
                      <p className="text-sm font-semibold text-foreground">{stats.completedRentals}</p>
                    </div>
                    <div className="col-span-2 rounded-xl bg-muted p-3">
                      <p className="text-[11px] font-medium text-muted-foreground">Dernière location</p>
                      <p className="text-sm font-semibold text-foreground">
                        {stats.lastRentalDate ? formatDate(stats.lastRentalDate) : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 px-4 py-3.5 text-primary-foreground">
                    <div>
                      <p className="text-[11px] font-medium text-primary-100">Revenu encaissé</p>
                      <p className="text-xl font-bold">{formatAmount(stats.totalRevenue)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <Skeleton className="h-16 w-full" />
              )}
            </div>

            {/* Only meaningful once the car is retired — a still-active car's
                purchase cost hasn't finished being "worked off" yet, so a
                net result here would be premature rather than informative. */}
            {car.status === 'OUT_OF_SERVICE' && (
              <>
                <Separator className="my-4" />

                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Bilan financier
                  </p>
                  {!profitability ? (
                    <Skeleton className="h-40 w-full" />
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-muted p-3">
                          <p className="text-[11px] font-medium text-muted-foreground">
                            Revenus totaux
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatAmount(profitability.totalRevenue)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted p-3">
                          <p className="text-[11px] font-medium text-muted-foreground">
                            Prix d'achat
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {profitability.purchasePrice !== null
                              ? formatAmount(profitability.purchasePrice)
                              : 'Non renseigné'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted p-3">
                          <p className="text-[11px] font-medium text-muted-foreground">Dépenses</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatAmount(profitability.totalExpenses)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-muted p-3">
                          <p className="text-[11px] font-medium text-muted-foreground">Entretien</p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatAmount(profitability.totalMaintenanceCost)}
                          </p>
                        </div>
                        <div className="col-span-2 rounded-xl bg-muted p-3">
                          <p className="text-[11px] font-medium text-muted-foreground">
                            Coût total (achat + dépenses + entretien)
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {formatAmount(profitability.totalCost)}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`flex items-center justify-between rounded-xl px-4 py-3.5 ${
                          profitability.netResult >= 0
                            ? 'bg-success text-success-foreground'
                            : 'bg-destructive text-destructive-foreground'
                        }`}
                      >
                        <div>
                          <p className="text-[11px] font-medium opacity-90">Résultat net</p>
                          <p className="text-xl font-bold">{formatAmount(profitability.netResult)}</p>
                        </div>
                        {profitability.roiPercent !== null && (
                          <p className="text-sm font-semibold">
                            ROI {profitability.roiPercent.toFixed(1)}%
                          </p>
                        )}
                      </div>

                      {profitability.netResultPerDay !== null && (
                        <p className="text-xs text-muted-foreground">
                          Soit {formatAmount(profitability.netResultPerDay)} net par jour de
                          possession ({profitability.ownershipDays} jours).
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}

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

      <ConfirmDialog
        open={outOfServiceConfirmOpen}
        onOpenChange={setOutOfServiceConfirmOpen}
        title="Mettre cette voiture hors service ?"
        description={
          car
            ? `${car.brand} ${car.model} (${car.licensePlate}) sera marquée hors service. Cette action est définitive : son statut ne pourra plus être modifié par la suite.`
            : 'Cette action est définitive : le statut ne pourra plus être modifié par la suite.'
        }
        confirmLabel="Mettre hors service"
        variant="destructive"
        onConfirm={() => handleStatusChange('OUT_OF_SERVICE')}
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

