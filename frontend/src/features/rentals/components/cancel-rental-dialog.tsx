import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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

export function CancelRentalDialog({ open, onOpenChange, rental }: CancelRentalDialogProps) {
  const [reason, setReason] = useState('');
  const cancelMutation = useCancelRentalMutation();

  async function handleConfirm() {
    try {
      await cancelMutation.mutateAsync({
        id: rental.id,
        input: { cancelledReason: reason.trim() === '' ? undefined : reason.trim() },
      });
      toast.success('Location annulée.');
      setReason('');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'annulation."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler cette location ?</DialogTitle>
          <DialogDescription>
            La réservation {rental.rentalNumber} sera annulée. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cancelledReason">Motif (optionnel)</Label>
          <Textarea
            id="cancelledReason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

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
