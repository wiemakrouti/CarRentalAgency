import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { PAYMENT_METHODS, PAYMENT_STATUSES, updatePaymentSchema, type UpdatePaymentInput } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Payment } from '../api/finances.api';
import { useUpdatePaymentMutation } from '../hooks/use-payments';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from '../lib/finance-labels';

type PaymentSettleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
};

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

// `paidAt` is kept as a plain "yyyy-MM-dd" string (or '') here — the format
// the native <input type="date"> actually displays — rather than a Date
// object. react-hook-form's `register` assigns defaultValues straight onto
// the input's DOM value on mount; a Date object stringifies to something
// like "Wed Sep 09 2026 ...", which the browser rejects, silently blanking
// the field. Zod's `z.coerce.date()` on the schema turns the string back
// into a real Date at submit time.
function buildDefaultValues(payment: Payment): UpdatePaymentInput {
  return {
    amount: Number(payment.amount),
    method: payment.method,
    status: payment.status,
    paidAt: toDateInputValue(payment.paidAt) as unknown as Date | null,
  };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function PaymentSettleDialog({ open, onOpenChange, payment }: PaymentSettleDialogProps) {
  const updateMutation = useUpdatePaymentMutation();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdatePaymentInput>({
    resolver: zodResolver(updatePaymentSchema),
    defaultValues: buildDefaultValues(payment),
  });

  // Reset on every open, not just once at mount — this dialog is created
  // once per row and stays mounted (only Radix's own visibility toggles),
  // so without this a stale reopen after the underlying payment data
  // changed elsewhere would keep showing whatever was loaded the first
  // time it opened (same class of bug as ExpenseFormDialog).
  useEffect(() => {
    if (open) reset(buildDefaultValues(payment));
  }, [open, payment, reset]);

  async function onSubmit(values: UpdatePaymentInput) {
    try {
      await updateMutation.mutateAsync({ id: payment.id, input: values });
      toast.success('Paiement mis à jour.');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la mise à jour.'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>Régler / corriger le paiement</DialogTitle>
          <DialogDescription>
            {PAYMENT_TYPE_LABELS[payment.type]} — corrigez le montant ou la méthode, et marquez-le comme encaissé.
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
              <Label htmlFor="amount">Montant (DT)</Label>
              <Input id="amount" type="number" step="0.001" {...register('amount', { setValueAs: Number })} />
              {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="paidAt">Date d&apos;encaissement</Label>
              {/* z.coerce.date() can't coerce '' (an emptied date input) into
                  null on its own — it'd throw as an invalid date — so this
                  still needs to map that one case by hand. Non-empty values
                  pass through as the raw string; the schema coerces those. */}
              <Input id="paidAt" type="date" {...register('paidAt', { setValueAs: (v) => (v === '' ? null : v) })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Statut</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {PAYMENT_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
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
            </div>
          </div>

          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
