import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { Car } from '../api/cars.api';
import { useArchiveCarMutation, useRestoreCarMutation } from '../hooks/use-cars';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

type CarRowActionsProps = {
  car: Car;
  onEdit: (car: Car) => void;
  onManageImages: (car: Car) => void;
};

export function CarRowActions({ car, onEdit, onManageImages }: CarRowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const archiveMutation = useArchiveCarMutation();
  const restoreMutation = useRestoreCarMutation();
  const isArchived = Boolean(car.deletedAt);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(car)}>Modifier</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onManageImages(car)}>Gérer les images</DropdownMenuItem>
          {isArchived ? (
            <DropdownMenuItem
              onClick={() =>
                restoreMutation.mutate(car.id, {
                  onSuccess: () => toast.success('Voiture restaurée.'),
                  onError: (err) => toast.error(errorMessage(err, 'Erreur lors de la restauration.')),
                })
              }
            >
              Restaurer
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmOpen(true)}>
              Archiver
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Archiver cette voiture ?"
        description={`${car.brand} ${car.model} (${car.licensePlate}) sera archivée. Vous pourrez la restaurer plus tard.`}
        confirmLabel="Archiver"
        variant="destructive"
        onConfirm={async () => {
          try {
            await archiveMutation.mutateAsync(car.id);
            toast.success('Voiture archivée.');
          } catch (err) {
            toast.error(errorMessage(err, "Erreur lors de l'archivage."));
            throw err;
          }
        }}
      />
    </>
  );
}
