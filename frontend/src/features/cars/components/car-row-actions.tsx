import { useState } from 'react';
import { CalendarDays, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { Car } from '../api/cars.api';
import { useCarDeletableQuery, useDeleteCarMutation } from '../hooks/use-cars';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

type CarRowActionsProps = {
  car: Car;
  onEdit: (car: Car) => void;
  onViewDetails: (car: Car) => void;
  onOpenCalendar: (car: Car) => void;
};

// Status is changed by clicking the status badge itself (CarStatusBadge),
// not from this menu — direct manipulation on the value shown, rather than
// a "Changer le statut" entry buried here.
export function CarRowActions({ car, onEdit, onViewDetails, onOpenCalendar }: CarRowActionsProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteMutation = useDeleteCarMutation();
  // Checked as soon as the dialog opens so it can show the right content —
  // a destructive confirm, or an explanatory notice — before the admin ever
  // clicks anything, instead of only finding out after submitting.
  const deletableQuery = useCarDeletableQuery(car.id, confirmDeleteOpen);
  const blocked = deletableQuery.data?.canDelete === false;

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Calendrier des locations"
              onClick={() => onOpenCalendar(car)}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Calendrier des locations</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewDetails(car)}>Voir les détails</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(car)}>Modifier</DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {blocked ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Suppression impossible"
          description={
            deletableQuery.data?.reason ??
            'Cette voiture a un historique et ne peut pas être supprimée définitivement.'
          }
          confirmLabel="Compris"
          onConfirm={() => {
            /* Nothing to do — informational only, closes the dialog. */
          }}
        />
      ) : (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Supprimer définitivement cette voiture ?"
          description={`${car.brand} ${car.model} (${car.licensePlate}) sera supprimée définitivement. Cette action est irréversible.`}
          confirmLabel="Supprimer"
          variant="destructive"
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(car.id);
              toast.success('Voiture supprimée définitivement.');
            } catch (err) {
              // CAR_HAS_HISTORY isn't a failure — it's the guard working as
              // intended (e.g. the precheck above raced with a new rental).
              // Gets its own toast instead of reading like a generic error.
              if (err instanceof ApiClientError && err.code === 'CAR_HAS_HISTORY') {
                toast.warning(err.message);
              } else {
                toast.error(errorMessage(err, 'Erreur lors de la suppression.'));
              }
              throw err;
            }
          }}
        />
      )}
    </>
  );
}
