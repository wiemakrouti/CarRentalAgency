import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AlertTriangle, CalendarPlus, CarFront, Loader2 } from 'lucide-react';
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

  const dailyRate = Number(rental.dailyRate);
  const currentTotal = Number(rental.totalAmount);
  const currentNights = calculateNights(pickupDate, currentPlannedReturn);

  const isValidExtension = Boolean(newReturnDate && newReturnDate > currentPlannedReturn);
  const additionalNights = isValidExtension ? calculateNights(pickupDate, newReturnDate!) - currentNights : 0;
  const estimatedAdditionalAmount = additionalNights * dailyRate;
  const newTotal = currentTotal + estimatedAdditionalAmount;

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
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>Prolonger la location</DialogTitle>
          <DialogDescription>
            Retour actuellement prévu le {currentPlannedReturn.toLocaleDateString('fr-TN')}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="newReturnDate">Nouvelle date de retour</Label>
              <Input
                id="newReturnDate"
                type="date"
                {...register('newReturnDate', { setValueAs: (v) => (v === '' ? undefined : new Date(v)) })}
              />
              {errors.newReturnDate && <p className="text-sm text-destructive">{errors.newReturnDate.message}</p>}
            </div>

            {/* Same receipt-style breakdown language as Return/Activate — the
                current contract amount, then what the extension adds on top,
                then the resulting new total. */}
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CarFront className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    Location actuelle
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {currentTotal.toLocaleString('fr-TN')} DT
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {currentNights} j × {dailyRate.toLocaleString('fr-TN')} DT
                    </p>
                  </div>
                </div>

                {newReturnDateValue && !isValidExtension ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    La nouvelle date doit être postérieure au {currentPlannedReturn.toLocaleDateString('fr-TN')}.
                  </div>
                ) : isValidExtension ? (
                  <div className="flex items-center justify-between gap-3 bg-primary/5 px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <CalendarPlus className="h-3.5 w-3.5 shrink-0" />
                      Prolongation
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums text-primary">
                        +{estimatedAdditionalAmount.toLocaleString('fr-TN')} DT
                      </p>
                      <p className="text-[11px] text-primary/75">
                        {additionalNights} j × {dailyRate.toLocaleString('fr-TN')} DT
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-2.5 text-sm text-muted-foreground">Choisissez une nouvelle date de retour.</div>
                )}
              </div>

              {isValidExtension && (
                <div className="flex items-center justify-between gap-3 border-t border-border bg-primary/10 px-4 py-3">
                  <span className="text-sm font-bold text-foreground">Nouveau total</span>
                  <span className="font-mono text-lg font-extrabold tabular-nums text-primary">
                    {newTotal.toLocaleString('fr-TN')} DT
                  </span>
                </div>
              )}
            </div>
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
