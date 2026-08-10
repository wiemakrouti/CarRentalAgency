import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { PAYMENT_METHODS, PAYMENT_STATUSES, updatePaymentSchema, type UpdatePaymentInput } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function PaymentSettleDialog({ open, onOpenChange, payment }: PaymentSettleDialogProps) {
  const updateMutation = useUpdatePaymentMutation();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdatePaymentInput>({
    resolver: zodResolver(updatePaymentSchema),
    defaultValues: {
      amount: Number(payment.amount),
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt ? new Date(payment.paidAt) : null,
      notes: payment.notes,
    },
  });

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
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Régler / corriger le paiement</DialogTitle>
          <DialogDescription>
            {PAYMENT_TYPE_LABELS[payment.type]} — corrigez le montant ou la méthode, et marquez-le comme encaissé.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
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
                defaultValue={toDateInputValue(payment.paidAt)}
                {...register('paidAt', { setValueAs: (v) => (v === '' ? null : new Date(v)) })}
              />
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

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optionnel)</Label>
            <Textarea id="notes" rows={2} {...register('notes', { setValueAs: (v) => (v === '' ? null : v) })} />
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
