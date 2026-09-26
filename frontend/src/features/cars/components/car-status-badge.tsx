import { useState } from 'react';
import { toast } from 'sonner';
import { MANUALLY_SETTABLE_CAR_STATUSES } from '@car-rental/shared';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ApiClientError } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Car, ManualCarStatus } from '../api/cars.api';
import { useUpdateCarStatusMutation } from '../hooks/use-cars';
import { CAR_STATUS_BADGE_VARIANT, CAR_STATUS_LABELS } from '../lib/car-labels';
import { CarRentedNoticeDialog } from './car-rented-notice-dialog';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

type CarStatusBadgeProps = { car: Car };

// Direct manipulation: click the status badge — wherever it's shown (table,
// grid) — to change it right there, instead of a "Changer le statut" entry
// buried in the row's "..." menu.
export function CarStatusBadge({ car }: CarStatusBadgeProps) {
  const [open, setOpen] = useState(false);
  const [rentedNoticeOpen, setRentedNoticeOpen] = useState(false);
  const [outOfServiceConfirmOpen, setOutOfServiceConfirmOpen] = useState(false);
  const updateStatusMutation = useUpdateCarStatusMutation();
  const isRented = car.status === 'RENTED';
  const isOutOfService = car.status === 'OUT_OF_SERVICE';

  function handleStatusChange(status: ManualCarStatus) {
    setOpen(false);
    updateStatusMutation.mutate(
      { id: car.id, status },
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

  // OUT_OF_SERVICE means sold/retired for good — routed through a
  // confirmation instead of applying immediately, since the backend then
  // refuses any further status change (see CarsService.update).
  function handleSelectStatus(status: ManualCarStatus) {
    if (status === 'OUT_OF_SERVICE') {
      setOpen(false);
      setOutOfServiceConfirmOpen(true);
    } else {
      handleStatusChange(status);
    }
  }

  return (
    <>
      {/* Once retired, there's nothing left to do with the status — same
          static-badge treatment the RENTED case gets via its own notice
          dialog, just with no action behind it at all. */}
      {isOutOfService ? (
        <Badge variant={CAR_STATUS_BADGE_VARIANT[car.status]}>
          {CAR_STATUS_LABELS[car.status]}
        </Badge>
      ) : (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                if (isRented) {
                  setRentedNoticeOpen(true);
                } else {
                  setOpen((next) => !next);
                }
              }}
            >
              <Badge variant={CAR_STATUS_BADGE_VARIANT[car.status]}>
                {CAR_STATUS_LABELS[car.status]}
              </Badge>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-44 p-1"
            align="start"
            onClick={(e) => e.stopPropagation()}
          >
            {MANUALLY_SETTABLE_CAR_STATUSES.map((s) => (
              <Button
                key={s}
                type="button"
                variant="ghost"
                size="sm"
                disabled={car.status === s}
                onClick={() => handleSelectStatus(s)}
                className="w-full justify-start font-normal"
              >
                {CAR_STATUS_LABELS[s]}
              </Button>
            ))}
          </PopoverContent>
        </Popover>
      )}

      <CarRentedNoticeDialog
        open={rentedNoticeOpen}
        onOpenChange={setRentedNoticeOpen}
        carId={car.id}
      />

      <ConfirmDialog
        open={outOfServiceConfirmOpen}
        onOpenChange={setOutOfServiceConfirmOpen}
        title="Mettre cette voiture hors service ?"
        description={`${car.brand} ${car.model} (${car.licensePlate}) sera marquée hors service. Cette action est définitive : son statut ne pourra plus être modifié par la suite.`}
        confirmLabel="Mettre hors service"
        variant="destructive"
        onConfirm={() => handleStatusChange('OUT_OF_SERVICE')}
      />
    </>
  );
}
