import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Wallet } from 'lucide-react';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import type { Rental } from '../api/rentals.api';
import { useCancelRentalMutation } from '../hooks/use-rentals';

type CancelRentalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental: Rental;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

// Two cases share this dialog:
// - a RESERVED rental: plain cancellation, payments untouched (the admin
//   settles any advance payment by hand);
// - an ACTIVE rental on its handover day (see canCancelHandover): the
//   handover is called off on the spot — the car comes back to
//   "Disponible" and everything collected is refunded in full (agency
//   rule), so the reason is required for the record.
export function CancelRentalDialog({ open, onOpenChange, rental }: CancelRentalDialogProps) {
  const cancelMutation = useCancelRentalMutation();
  const isHandover = rental.status === 'ACTIVE';
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const paidAmount = rental.payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  async function handleConfirm() {
    const cancelledReason = reason.trim();
    if (isHandover && !cancelledReason) {
      setReasonError("Indiquez le motif de l'annulation.");
      return;
    }
    try {
      await cancelMutation.mutateAsync({
        id: rental.id,
        input: cancelledReason ? { cancelledReason } : {},
      });
      toast.success(isHandover ? 'Remise des clés annulée, paiements remboursés.' : 'Location annulée.');
      setReason('');
      setReasonError(null);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'annulation."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>{isHandover ? 'Annuler la remise des clés ?' : 'Annuler cette location ?'}</DialogTitle>
          <DialogDescription>
            {isHandover
              ? `La location ${rental.rentalNumber} sera annulée et la voiture redeviendra disponible. Cette action est irréversible.`
              : `La réservation ${rental.rentalNumber} sera annulée. Cette action est irréversible.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {isHandover && (
            <div className="space-y-2">
              <Label htmlFor="cancelledReason" required>
                Motif
              </Label>
              <Textarea
                id="cancelledReason"
                placeholder="Ex. Essai de conduite non concluant"
                className="min-h-16 resize-none"
                rows={2}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (reasonError) setReasonError(null);
                }}
              />
              {reasonError && <p className="text-sm text-destructive">{reasonError}</p>}
            </div>
          )}

          {paidAmount > 0 && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {isHandover ? (
                <p>
                  <span className="font-mono font-semibold tabular-nums">{paidAmount.toLocaleString('fr-TN')} DT</span>{' '}
                  encaissés seront marqués comme remboursés — rendez ce montant au client.
                </p>
              ) : (
                <p>
                  Ce client a déjà réglé{' '}
                  <span className="font-mono font-semibold tabular-nums">{paidAmount.toLocaleString('fr-TN')} DT</span>{' '}
                  pour cette réservation — l&apos;annulation ne rembourse rien automatiquement.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Retour
          </Button>
          <Button type="button" variant="destructive" disabled={cancelMutation.isPending} onClick={handleConfirm}>
            {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isHandover ? 'Annuler et rembourser' : 'Annuler la location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
