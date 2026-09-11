import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { AlertTriangle, CarFront, CheckCircle2, Loader2, Wrench } from 'lucide-react';
import {
  MANUALLY_SETTABLE_CAR_STATUSES,
  returnRentalSchema,
  type ReturnRentalInput,
} from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useReturnRentalMutation } from '../hooks/use-rentals';
import { toLocalDayOnly } from '../lib/rental-calendar';
import { CAR_STATUS_LABELS } from '@/features/cars/lib/car-labels';

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
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ReturnRentalInput>({
    resolver: zodResolver(returnRentalSchema),
    defaultValues: {
      mileageAtReturn: rental.car.mileage,
      fuelLevelAtReturn: '',
      carStatusAfterReturn: 'AVAILABLE',
    },
  });

  const now = Date.now();
  const plannedReturn = new Date(rental.plannedReturnDate).getTime();
  // Full calendar days late, mirroring RentalsService.returnRental's own
  // formula exactly — closing out any time on the planned return day itself
  // is 0 days late, not 1: comparing the exact instant (the old `now >
  // plannedReturn` + Math.ceil) rounded any moment past midnight of that day
  // up to a full day late, previewing a fee that was never actually owed.
  // Both sides get truncated to local midnight, not just `now` — plannedReturn
  // is a UTC-midnight value, which for Tunisia's UTC+1 offset is an hour after
  // local midnight; leaving it untruncated silently rounded every clean N-day
  // gap down to N-1.
  const lateDays = Math.max(
    0,
    Math.floor((toLocalDayOnly(new Date(now)).getTime() - toLocalDayOnly(new Date(plannedReturn)).getTime()) / MS_PER_DAY),
  );
  const dailyRate = Number(rental.dailyRate);
  const estimatedLateFee = lateDays * dailyRate;
  // The rental's own contract amount (nights × tarif, already reflecting any
  // extensions) — "Total estimé" is what the client actually owes overall,
  // not just the extra charges this closing adds on top of it. Nights
  // derived from totalAmount / dailyRate (rather than re-deriving from
  // pickup/plannedReturn dates) so the displayed "N jours × tarif" always
  // multiplies back out to the exact totalAmount shown, extensions included.
  const rentalAmount = Number(rental.totalAmount);
  const rentalNights = Math.round(rentalAmount / dailyRate);
  // Live-watched, not just read at submit — the receipt breakdown below
  // updates as the admin types the damage amount, same as the late-fee line
  // (computed) does automatically from the return date.
  const damageFeeAmount = Number(watch('damageFeeAmount')) || 0;
  const estimatedTotal = rentalAmount + estimatedLateFee + damageFeeAmount;

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
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>Clôturer la location</DialogTitle>
          <DialogDescription>
            Enregistrez l&apos;état du véhicule {rental.car.brand} {rental.car.model} au retour.
          </DialogDescription>
        </DialogHeader>

        {/* The footer sits outside this scrolling div — a sticky footer
            sharing the same scroll container as tall content gets visually
            pulled up over whatever hasn't scrolled past it yet, overlapping
            it instead of floating cleanly above it (see rental-form-dialog). */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mileageAtReturn" required>
                  Kilométrage au retour
                </Label>
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
                <Label htmlFor="fuelLevelAtReturn" required>
                  Niveau de carburant
                </Label>
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
              <Label>État de la voiture après retour</Label>
              <Controller
                name="carStatusAfterReturn"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
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
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label>Dommage</Label>
              <div className="space-y-2">
                <Label htmlFor="damageFeeAmount" className="text-xs font-normal text-muted-foreground">
                  Frais de dommage
                </Label>
                <Input
                  id="damageFeeAmount"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Montant en DT"
                  {...register('damageFeeAmount', {
                    setValueAs: (v) => (v === '' ? undefined : Number(v)),
                  })}
                />
                {errors.damageFeeAmount && (
                  <p className="text-sm text-destructive">{errors.damageFeeAmount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="damageFeeNotes" className="text-xs font-normal text-muted-foreground">
                  Description de dommage
                </Label>
                <Textarea
                  id="damageFeeNotes"
                  placeholder="Ex. Rayure portière avant droite"
                  className="min-h-16 resize-none"
                  rows={2}
                  {...register('damageFeeNotes')}
                />
                {errors.damageFeeNotes && (
                  <p className="text-sm text-destructive">{errors.damageFeeNotes.message}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Receipt-style breakdown — same dotted-ledger language as the
                rental detail sheet's own Paiements list, so "what will this
                closing cost" reads the same way everywhere in the app rather
                than as a one-off paragraph of text. */}
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CarFront className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    Location
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {rentalAmount.toLocaleString('fr-TN')} DT
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {rentalNights} j × {dailyRate.toLocaleString('fr-TN')} DT
                    </p>
                  </div>
                </div>

                {lateDays > 0 ? (
                  <div className="flex items-center justify-between gap-3 bg-destructive/5 px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Retard
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-semibold tabular-nums text-destructive">
                        {estimatedLateFee.toLocaleString('fr-TN')} DT
                      </p>
                      <p className="text-[11px] text-destructive/75">
                        {lateDays} j × {dailyRate.toLocaleString('fr-TN')} DT
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-success/5 px-4 py-2.5 text-sm font-medium text-success">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Retour dans les délais — aucun frais de retard
                  </div>
                )}

                {damageFeeAmount > 0 && (
                  <div className="flex items-center justify-between gap-3 bg-destructive/5 px-4 py-2.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <Wrench className="h-3.5 w-3.5 shrink-0" />
                      Dommage
                    </div>
                    <p className="font-mono text-sm font-semibold tabular-nums text-destructive">
                      {damageFeeAmount.toLocaleString('fr-TN')} DT
                    </p>
                  </div>
                )}
              </div>

              <div
                className={cn(
                  'flex items-center justify-between gap-3 border-t border-border px-4 py-3',
                  lateDays > 0 || damageFeeAmount > 0 ? 'bg-destructive/10' : 'bg-muted',
                )}
              >
                <span className="text-sm font-bold text-foreground">Total estimé</span>
                <span
                  className={cn(
                    'font-mono text-lg font-extrabold tabular-nums',
                    lateDays > 0 || damageFeeAmount > 0 ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {estimatedTotal.toLocaleString('fr-TN')} DT
                </span>
              </div>
            </div>
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
