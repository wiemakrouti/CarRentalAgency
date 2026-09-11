import { toast } from 'sonner';
import { Loader2, Wallet } from 'lucide-react';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
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

export function CancelRentalDialog({ open, onOpenChange, rental }: CancelRentalDialogProps) {
  const cancelMutation = useCancelRentalMutation();

  // A RESERVED rental can already carry a completed payment (a deposit
  // collected in advance, say) even though it's never been activated —
  // RentalsService.cancel() doesn't touch payments at all, so nothing gets
  // refunded automatically. Worth surfacing here, the same "show the real
  // financial state" instinct as Clôturer/Activer/Prolonger, even though
  // there's no total to break down for a cancellation itself.
  const paidAmount = rental.payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  async function handleConfirm() {
    try {
      await cancelMutation.mutateAsync({ id: rental.id, input: {} });
      toast.success('Location annulée.');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'annulation."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-md flex-col">
        <DialogHeader>
          <DialogTitle>Annuler cette location ?</DialogTitle>
          <DialogDescription>
            La réservation {rental.rentalNumber} sera annulée. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>

        {paidAmount > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Ce client a déjà réglé{' '}
                <span className="font-mono font-semibold tabular-nums">{paidAmount.toLocaleString('fr-TN')} DT</span>{' '}
                pour cette réservation — l&apos;annulation ne rembourse rien automatiquement.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Retour
          </Button>
          <Button type="button" variant="destructive" disabled={cancelMutation.isPending} onClick={handleConfirm}>
            {cancelMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Annuler la location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
