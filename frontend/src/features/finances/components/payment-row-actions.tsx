import { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { Payment } from '../api/finances.api';
import { useArchivePaymentMutation, useRestorePaymentMutation } from '../hooks/use-payments';
import { PaymentSettleDialog } from './payment-settle-dialog';
import { PaymentAttachmentManagerDialog } from './payment-attachment-manager-dialog';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

type PaymentRowActionsProps = {
  payment: Payment;
};

export function PaymentRowActions({ payment }: PaymentRowActionsProps) {
  const [settleOpen, setSettleOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const archiveMutation = useArchivePaymentMutation();
  const restoreMutation = useRestorePaymentMutation();
  const isArchived = Boolean(payment.deletedAt);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setSettleOpen(true)}>Régler / corriger</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAttachmentsOpen(true)}>
            Pièces jointes ({payment.attachments.length})
          </DropdownMenuItem>
          {isArchived ? (
            <DropdownMenuItem
              onClick={() =>
                restoreMutation.mutate(payment.id, {
                  onSuccess: () => toast.success('Paiement restauré.'),
                  onError: (err) => toast.error(errorMessage(err, 'Erreur lors de la restauration.')),
                })
              }
            >
              Restaurer
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmOpen(true)}>
              Archiver
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <PaymentSettleDialog open={settleOpen} onOpenChange={setSettleOpen} payment={payment} />
      <PaymentAttachmentManagerDialog
        open={attachmentsOpen}
        onOpenChange={setAttachmentsOpen}
        paymentId={payment.id}
        rentalId={payment.rentalId}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Archiver ce paiement ?"
        description="Ce paiement sera archivé. Vous pourrez le restaurer plus tard."
        confirmLabel="Archiver"
        variant="destructive"
        onConfirm={async () => {
          try {
            await archiveMutation.mutateAsync(payment.id);
            toast.success('Paiement archivé.');
          } catch (err) {
            toast.error(errorMessage(err, "Erreur lors de l'archivage."));
            throw err;
          }
        }}
      />
    </>
  );
}
