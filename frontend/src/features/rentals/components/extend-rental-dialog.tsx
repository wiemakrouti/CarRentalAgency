import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { extendRentalSchema, type ExtendRentalInput } from '@car-rental/shared';

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
import { useExtendRentalMutation } from '../hooks/use-rentals';

type ExtendRentalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: Rental;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Mirrors backend/src/services/rentals.service.ts's calculateNights so the
// preview matches what the server will actually charge.
function calculateNights(pickupDate: Date, returnDate: Date): number {
  const nights = Math.ceil((returnDate.getTime() - pickupDate.getTime()) / MS_PER_DAY);
  return Math.max(nights, 1);
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ExtendRentalDialog({ open, onOpenChange, rental }: ExtendRentalDialogProps) {
  const extendMutation = useExtendRentalMutation();

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ExtendRentalInput>({
    resolver: zodResolver(extendRentalSchema),
  });

  const newReturnDateValue = watch('newReturnDate');
  const pickupDate = new Date(rental.pickupDate);
  const currentPlannedReturn = new Date(rental.plannedReturnDate);
  const newReturnDate = newReturnDateValue ? new Date(newReturnDateValue) : null;

  const isValidExtension = Boolean(newReturnDate && newReturnDate > currentPlannedReturn);
  const additionalNights = isValidExtension
    ? calculateNights(pickupDate, newReturnDate!) - calculateNights(pickupDate, currentPlannedReturn)
    : 0;
  const estimatedAdditionalAmount = additionalNights * Number(rental.dailyRate);

  async function onSubmit(values: ExtendRentalInput) {
    try {
      await extendMutation.mutateAsync({ id: rental.id, input: values });
      toast.success('Location prolongée.');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la prolongation.'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Prolonger la location</DialogTitle>
          <DialogDescription>
            Retour actuellement prévu le {currentPlannedReturn.toLocaleDateString('fr-TN')}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="newReturnDate">Nouvelle date de retour</Label>
            <Input
              id="newReturnDate"
              type="date"
              {...register('newReturnDate', { setValueAs: (v) => (v === '' ? undefined : new Date(v)) })}
            />
            {errors.newReturnDate && <p className="text-sm text-destructive">{errors.newReturnDate.message}</p>}
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
            {newReturnDateValue && !isValidExtension ? (
              <p className="text-destructive">
                La nouvelle date doit être postérieure au {currentPlannedReturn.toLocaleDateString('fr-TN')}.
              </p>
            ) : additionalNights > 0 ? (
              <>
                <p>
                  {additionalNights} nuit{additionalNights > 1 ? 's' : ''} supplémentaire
                  {additionalNights > 1 ? 's' : ''} × {Number(rental.dailyRate).toLocaleString('fr-TN')} DT ={' '}
                  <span className="font-semibold">{estimatedAdditionalAmount.toLocaleString('fr-TN')} DT</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Estimation à titre indicatif — le montant final est calculé par le serveur à la confirmation.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground">Choisissez une nouvelle date de retour.</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={extendMutation.isPending || !isValidExtension}>
              {extendMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Prolonger
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
