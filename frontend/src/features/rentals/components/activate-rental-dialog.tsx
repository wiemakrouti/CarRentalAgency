import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { CarFront, Clock, Loader2 } from 'lucide-react';
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

import { cn } from '@/lib/utils';
import type { Rental } from '../api/rentals.api';
import { useActivateRentalMutation } from '../hooks/use-rentals';
import { toLocalDayOnly } from '../lib/rental-calendar';

type ActivateRentalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: Rental;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

  // Mirrors RentalsService.activate's own recalculation exactly: activation
  // always records the moment the keys actually change hands, whether
  // that's later than booked (the car sat unused, so don't bill for those
  // days) or earlier (the client showed up ahead of schedule — the rental
  // simply starts today instead of leaving an ACTIVE rental with a pickup
  // date still in the future). Only a genuinely on-time activation leaves
  // the total untouched.
  const now = Date.now();
  const pickupTime = new Date(rental.pickupDate).getTime();
  const plannedReturnTime = new Date(rental.plannedReturnDate).getTime();
  const dailyRate = Number(rental.dailyRate);
  // Compared by calendar day, not the exact instant — activating later the
  // same day the pickup was scheduled for is on time, not late: comparing
  // the raw instant instead flagged it late the moment any hour past
  // midnight of the pickup day ticked by.
  const today = toLocalDayOnly(new Date(now)).getTime();
  const pickupDay = toLocalDayOnly(new Date(pickupTime)).getTime();
  const isLatePickup = today > pickupDay;
  const isEarlyPickup = today < pickupDay;
  const isDateAdjusted = isLatePickup || isEarlyPickup;
  const lateDays = isLatePickup ? Math.round((today - pickupDay) / MS_PER_DAY) : 0;
  const earlyDays = isEarlyPickup ? Math.round((pickupDay - today) / MS_PER_DAY) : 0;

  const originalTotal = Number(rental.totalAmount);
  const originalNights = Math.round(originalTotal / dailyRate);

  const adjustedNights = isDateAdjusted ? Math.max(1, Math.ceil((plannedReturnTime - now) / MS_PER_DAY)) : originalNights;
  const adjustedTotal = isDateAdjusted ? adjustedNights * dailyRate : originalTotal;

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
            <Label htmlFor="mileageAtPickup" required>
              Kilométrage au départ
            </Label>
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
            <Label htmlFor="fuelLevelAtPickup" required>
              Niveau de carburant
            </Label>
            <Input
              id="fuelLevelAtPickup"
              placeholder="Ex. Plein, 3/4, Moitié..."
              {...register('fuelLevelAtPickup')}
            />
            {errors.fuelLevelAtPickup && (
              <p className="text-sm text-destructive">{errors.fuelLevelAtPickup.message}</p>
            )}
          </div>

          {/* Same receipt-style breakdown language as ReturnRentalDialog —
              only shows an adjustment when the pickup is actually late or
              early, so an on-time activation stays a single plain line. */}
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="divide-y divide-border">
              {isDateAdjusted ? (
                <>
                  <div className="flex items-center justify-between gap-3 px-4 py-2.5 opacity-60">
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <CarFront className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      Réservé initialement
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground line-through">
                        {originalTotal.toLocaleString('fr-TN')} DT
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {originalNights} j × {dailyRate.toLocaleString('fr-TN')} DT
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 bg-primary/5 px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      Ajusté ({isLatePickup ? `${lateDays} j de retard` : `${earlyDays} j d'avance`})
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums text-primary">
                        {adjustedTotal.toLocaleString('fr-TN')} DT
                      </p>
                      <p className="text-[11px] text-primary/75">
                        {adjustedNights} j × {dailyRate.toLocaleString('fr-TN')} DT
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CarFront className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    Location
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {originalTotal.toLocaleString('fr-TN')} DT
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {originalNights} j × {dailyRate.toLocaleString('fr-TN')} DT
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div
              className={cn(
                'flex items-center justify-between gap-3 border-t border-border px-4 py-3',
                isDateAdjusted ? 'bg-primary/10' : 'bg-muted',
              )}
            >
              <span className="text-sm font-bold text-foreground">
                {isDateAdjusted ? 'Total ajusté' : 'Total'}
              </span>
              <span
                className={cn(
                  'font-mono text-lg font-extrabold tabular-nums',
                  isDateAdjusted ? 'text-primary' : 'text-foreground',
                )}
              >
                {adjustedTotal.toLocaleString('fr-TN')} DT
              </span>
            </div>
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
