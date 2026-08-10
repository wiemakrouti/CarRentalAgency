import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageOff, Loader2, Trash2, Upload } from 'lucide-react';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingState } from '@/components/common/loading-state';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

import type { Payment, PaymentAttachment } from '../api/finances.api';
import { usePaymentQuery, useDeletePaymentAttachmentMutation, useUploadPaymentAttachmentMutation } from '../hooks/use-payments';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

type PaymentAttachmentManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string | undefined;
  rentalId?: string;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function PaymentAttachmentManagerDialog({
  open,
  onOpenChange,
  paymentId,
  rentalId,
}: PaymentAttachmentManagerDialogProps) {
  const { data: payment, isLoading } = usePaymentQuery(paymentId ?? '');
  const uploadMutation = useUploadPaymentAttachmentMutation();
  const deleteMutation = useDeletePaymentAttachmentMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentToDelete, setAttachmentToDelete] = useState<PaymentAttachment | null>(null);

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !paymentId) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Seules les images JPEG, PNG ou WEBP sont autorisées.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Le fichier dépasse la taille maximale autorisée (5 Mo).');
      return;
    }

    uploadMutation.mutate(
      { paymentId, file, rentalId },
      {
        onSuccess: () => toast.success('Pièce jointe ajoutée.'),
        onError: (err) => toast.error(errorMessage(err, "Erreur lors de l'envoi du fichier.")),
      },
    );
  }

  const paymentForTitle: Payment | undefined = payment;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pièces jointes{paymentForTitle ? ` — ${paymentForTitle.amount} DT` : ''}</DialogTitle>
            <DialogDescription>Formats acceptés : JPEG, PNG, WEBP. Taille maximale : 5 Mo.</DialogDescription>
          </DialogHeader>

          {isLoading && <LoadingState message="Chargement des pièces jointes..." />}

          {payment && (
            <div className="space-y-4">
              {payment.attachments.length === 0 ? (
                <EmptyState
                  icon={ImageOff}
                  title="Aucune pièce jointe"
                  description="Ajoutez une photo (ex. dommages constatés)."
                />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {payment.attachments.map((attachment) => (
                    <div key={attachment.id} className="relative overflow-hidden rounded-lg border border-border">
                      <img src={attachment.url} alt="" className="h-32 w-full object-cover" />
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute right-2 top-2 h-7 w-7"
                        aria-label="Supprimer"
                        onClick={() => setAttachmentToDelete(attachment)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileSelected}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Ajouter une pièce jointe
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(attachmentToDelete)}
        onOpenChange={(next) => !next && setAttachmentToDelete(null)}
        title="Supprimer cette pièce jointe ?"
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={async () => {
          if (!paymentId || !attachmentToDelete) return;
          try {
            await deleteMutation.mutateAsync({ paymentId, attachmentId: attachmentToDelete.id, rentalId });
            toast.success('Pièce jointe supprimée.');
            setAttachmentToDelete(null);
          } catch (err) {
            toast.error(errorMessage(err, 'Erreur lors de la suppression.'));
            throw err;
          }
        }}
      />
    </>
  );
}
