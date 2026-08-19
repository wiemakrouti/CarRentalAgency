import { useState } from 'react';
import { toast } from 'sonner';
import { MANUALLY_SETTABLE_CAR_STATUSES } from '@car-rental/shared';

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
  const updateStatusMutation = useUpdateCarStatusMutation();
  const isRented = car.status === 'RENTED';

  function handleStatusChange(status: ManualCarStatus) {
    setOpen(false);
    updateStatusMutation.mutate(
      { id: car.id, status },
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
    <>
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
              onClick={() => handleStatusChange(s)}
              className="w-full justify-start font-normal"
            >
              {CAR_STATUS_LABELS[s]}
            </Button>
          ))}
        </PopoverContent>
      </Popover>

      <CarRentedNoticeDialog
        open={rentedNoticeOpen}
        onOpenChange={setRentedNoticeOpen}
        carId={car.id}
      />
    </>
  );
}
