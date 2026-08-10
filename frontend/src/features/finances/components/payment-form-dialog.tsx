import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { PAYMENT_METHODS, PAYMENT_TYPES, createPaymentSchema, type CreatePaymentInput } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRentalsQuery } from '@/features/rentals/hooks/use-rentals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { useCreatePaymentMutation } from '../hooks/use-payments';
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from '../lib/finance-labels';

type PaymentFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId?: string;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function PaymentFormDialog({ open, onOpenChange, rentalId }: PaymentFormDialogProps) {
  const [rentalSearch, setRentalSearch] = useState('');
  const debouncedRentalSearch = useDebouncedValue(rentalSearch);
  const { data: rentalsData, isLoading: isLoadingRentals } = useRentalsQuery({
    search: debouncedRentalSearch || undefined,
    pageSize: 20,
  });
  const createMutation = useCreatePaymentMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePaymentInput>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: { rentalId, method: 'CASH', type: 'RENTAL_PAYMENT' },
  });

  async function onSubmit(values: CreatePaymentInput) {
    try {
      await createMutation.mutateAsync(values);
      toast.success('Paiement enregistré.');
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'enregistrement."));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau paiement</DialogTitle>
          <DialogDescription>
            Enregistrez un paiement déjà encaissé pour une location (espèces, carte, virement...).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {!rentalId && (
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={rentalSearch}
                onChange={(e) => setRentalSearch(e.target.value)}
                placeholder="Rechercher par n° location, voiture ou client..."
              />
              <Controller
                name="rentalId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingRentals ? 'Chargement...' : 'Sélectionner une location'} />
                    </SelectTrigger>
                    <SelectContent>
                      {rentalsData?.items.map((rental) => (
                        <SelectItem key={rental.id} value={rental.id}>
                          {rental.rentalNumber} — {rental.client.firstName} {rental.client.lastName} (
                          {rental.car.brand} {rental.car.model})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.rentalId && <p className="text-sm text-destructive">{errors.rentalId.message}</p>}
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Montant (DT)</Label>
              <Input id="amount" type="number" step="0.001" {...register('amount', { setValueAs: Number })} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidAt">Date d&apos;encaissement</Label>
              <Input
                id="paidAt"
                type="date"
                {...register('paidAt', { setValueAs: (v) => (v === '' ? undefined : new Date(v)) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {PAYMENT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Méthode</Label>
              <Controller
                name="method"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.method && <p className="text-sm text-destructive">{errors.method.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea id="notes" rows={2} {...register('notes', { setValueAs: (v) => (v === '' ? null : v) })} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
