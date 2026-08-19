import { useState } from 'react';
import { ImageOff, Images } from 'lucide-react';
import { toast } from 'sonner';
import { MANUALLY_SETTABLE_CAR_STATUSES } from '@car-rental/shared';
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
import type { ManualCarStatus } from '../api/cars.api';
import { useCarQuery, useCarStatsQuery, useUpdateCarStatusMutation } from '../hooks/use-cars';
import { useRentalsQuery } from '@/features/rentals/hooks/use-rentals';
import {
  RENTAL_STATUS_BADGE_VARIANT,
  RENTAL_STATUS_LABELS,
} from '@/features/rentals/lib/rental-labels';
import {
  formatDocumentStatus,
  getDocumentStatuses,
  type DocumentLevel,
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
};

export function CarDetailSheet({ carId, open, onOpenChange, onManageImages }: CarDetailSheetProps) {
  const [rentedNoticeOpen, setRentedNoticeOpen] = useState(false);
  const { data: car, isLoading } = useCarQuery(carId ?? '');
  const { data: stats } = useCarStatsQuery(carId);
  const { data: rentals } = useRentalsQuery({ carId, pageSize: 5 }, { enabled: Boolean(carId) });
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
            <SheetHeader>
              <SheetTitle>
                {car.brand} {car.model}
              </SheetTitle>
              <SheetDescription>{car.licensePlate}</SheetDescription>
            </SheetHeader>

            <div className="relative mt-4 h-48 w-full">
              {primaryImage ? (
                <img
                  src={primaryImage.url}
                  alt=""
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-lg bg-muted">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="absolute bottom-2 right-2"
                onClick={onManageImages}
              >
                <Images className="h-4 w-4" />
                Gérer les images
              </Button>
            </div>

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
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Catégorie</dt>
                <dd>{CAR_CATEGORY_LABELS[car.category]}</dd>
                <dt className="text-muted-foreground">Transmission</dt>
                <dd>{TRANSMISSION_LABELS[car.transmission]}</dd>
                <dt className="text-muted-foreground">Carburant</dt>
                <dd>{FUEL_TYPE_LABELS[car.fuelType]}</dd>
                <dt className="text-muted-foreground">Année</dt>
                <dd>{car.year}</dd>
                <dt className="text-muted-foreground">Places</dt>
                <dd>{car.seats}</dd>
                <dt className="text-muted-foreground">Couleur</dt>
                <dd>{car.color}</dd>
                <dt className="text-muted-foreground">Kilométrage</dt>
                <dd>{car.mileage.toLocaleString('fr-TN')} km</dd>
                <dt className="text-muted-foreground">Tarif / jour</dt>
                <dd>{formatAmount(car.dailyRate)}</dd>
              </dl>
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
                    className="flex items-center justify-between rounded-md border border-border p-2 text-sm"
                  >
                    <div>
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
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Historique récent
              </p>
              {rentals && rentals.items.length > 0 ? (
                <ul className="space-y-2">
                  {rentals.items.map((rental) => (
                    <li
                      key={rental.id}
                      className="flex items-center justify-between rounded-md border border-border p-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{rental.rentalNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(rental.pickupDate)} → {formatDate(rental.plannedReturnDate)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatAmount(rental.totalAmount)}
                        </span>
                        <Badge variant={RENTAL_STATUS_BADGE_VARIANT[rental.status]}>
                          {RENTAL_STATUS_LABELS[rental.status]}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune location pour cette voiture.</p>
              )}
            </div>
          </>
        )}
      </SheetContent>

      <CarRentedNoticeDialog
        open={rentedNoticeOpen}
        onOpenChange={setRentedNoticeOpen}
        carId={carId ?? ''}
      />
    </Sheet>
  );
}

