import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { activateRentalSchema, type ActivateRentalInput } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Rental } from '../api/rentals.api';
import { useActivateRentalMutation } from '../hooks/use-rentals';

type ActivateRentalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: Rental;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ActivateRentalDialog({ open, onOpenChange, rental }: ActivateRentalDialogProps) {
  const activateMutation = useActivateRentalMutation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ActivateRentalInput>({
    resolver: zodResolver(activateRentalSchema),
    defaultValues: { mileageAtPickup: rental.car.mileage, fuelLevelAtPickup: '' },
  });

  async function onSubmit(values: ActivateRentalInput) {
    try {
      await activateMutation.mutateAsync({ id: rental.id, input: values });
      toast.success('Location activée : remise des clés enregistrée.');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'activation."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Activer la location</DialogTitle>
          <DialogDescription>
            Enregistrez l&apos;état du véhicule {rental.car.brand} {rental.car.model} à la remise des clés.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="mileageAtPickup">Kilométrage au départ</Label>
            <Input
              id="mileageAtPickup"
              type="number"
              {...register('mileageAtPickup', { setValueAs: Number })}
            />
            {errors.mileageAtPickup && (
              <p className="text-sm text-destructive">{errors.mileageAtPickup.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="fuelLevelAtPickup">Niveau de carburant</Label>
            <Input
              id="fuelLevelAtPickup"
              placeholder="Ex. Plein, 3/4, Moitié..."
              {...register('fuelLevelAtPickup')}
            />
            {errors.fuelLevelAtPickup && (
              <p className="text-sm text-destructive">{errors.fuelLevelAtPickup.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={activateMutation.isPending}>
              {activateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Activer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
