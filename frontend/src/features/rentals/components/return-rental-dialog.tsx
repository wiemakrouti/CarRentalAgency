import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { returnRentalSchema, type ReturnRentalInput } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Rental } from '../api/rentals.api';
import { useReturnRentalMutation } from '../hooks/use-rentals';

type ReturnRentalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: Rental;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ReturnRentalDialog({ open, onOpenChange, rental }: ReturnRentalDialogProps) {
  const returnMutation = useReturnRentalMutation();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ReturnRentalInput>({
    resolver: zodResolver(returnRentalSchema),
    defaultValues: { mileageAtReturn: rental.car.mileage, fuelLevelAtReturn: '' },
  });

  const damageFeeAmount = watch('damageFeeAmount');

  const now = Date.now();
  const plannedReturn = new Date(rental.plannedReturnDate).getTime();
  const lateDays = now > plannedReturn ? Math.ceil((now - plannedReturn) / MS_PER_DAY) : 0;
  const estimatedLateFee = lateDays * Number(rental.dailyRate);
  const estimatedDamageFee = typeof damageFeeAmount === 'number' && damageFeeAmount > 0 ? damageFeeAmount : 0;
  const estimatedTotal = estimatedLateFee + estimatedDamageFee;

  async function onSubmit(values: ReturnRentalInput) {
    try {
      await returnMutation.mutateAsync({ id: rental.id, input: values });
      toast.success('Location clôturée.');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la clôture.'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Clôturer la location</DialogTitle>
          <DialogDescription>
            Enregistrez l&apos;état du véhicule {rental.car.brand} {rental.car.model} au retour.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mileageAtReturn">Kilométrage au retour</Label>
              <Input
                id="mileageAtReturn"
                type="number"
                {...register('mileageAtReturn', { setValueAs: Number })}
              />
              {errors.mileageAtReturn && (
                <p className="text-sm text-destructive">{errors.mileageAtReturn.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="fuelLevelAtReturn">Niveau de carburant</Label>
              <Input
                id="fuelLevelAtReturn"
                placeholder="Ex. Plein, 3/4, Moitié..."
                {...register('fuelLevelAtReturn')}
              />
              {errors.fuelLevelAtReturn && (
                <p className="text-sm text-destructive">{errors.fuelLevelAtReturn.message}</p>
              )}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="damageFeeAmount">Frais de dommage (optionnel)</Label>
            <Input
              id="damageFeeAmount"
              type="number"
              step="0.001"
              min="0"
              {...register('damageFeeAmount', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
            />
            {errors.damageFeeAmount && (
              <p className="text-sm text-destructive">{errors.damageFeeAmount.message}</p>
            )}
          </div>
          {estimatedDamageFee > 0 && (
            <div className="space-y-2">
              <Label htmlFor="damageFeeNotes">Détail des dommages</Label>
              <Textarea id="damageFeeNotes" rows={2} {...register('damageFeeNotes')} />
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {lateDays > 0 ? (
              <p>
                Retard estimé : {lateDays} jour{lateDays > 1 ? 's' : ''} ×{' '}
                {Number(rental.dailyRate).toLocaleString('fr-TN')} DT ={' '}
                <span className="font-semibold">{estimatedLateFee.toLocaleString('fr-TN')} DT</span>
              </p>
            ) : (
              <p>Retour dans les délais — aucun frais de retard.</p>
            )}
            {estimatedDamageFee > 0 && (
              <p>
                Dommages : <span className="font-semibold">{estimatedDamageFee.toLocaleString('fr-TN')} DT</span>
              </p>
            )}
            <p className="mt-1 font-semibold">Total estimé : {estimatedTotal.toLocaleString('fr-TN')} DT</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Estimation à titre indicatif — le montant final est calculé par le serveur à la confirmation.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={returnMutation.isPending}>
              {returnMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Clôturer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
