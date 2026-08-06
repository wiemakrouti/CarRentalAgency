import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CLIENT_DOCUMENT_TYPES, type ClientDocumentType } from '@car-rental/shared';
import { ExternalLink, FileX, Loader2, MoreHorizontal, Upload } from 'lucide-react';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingState } from '@/components/common/loading-state';
import { EmptyState } from '@/components/common/empty-state';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

import type { ClientDocument } from '../api/clients.api';
import {
  useClientQuery,
  useDeleteClientDocumentMutation,
  useUploadClientDocumentMutation,
} from '../hooks/use-clients';
import { CLIENT_DOCUMENT_TYPE_LABELS } from '../lib/client-labels';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

type ClientDocumentManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string | undefined;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function ClientDocumentManagerDialog({ open, onOpenChange, clientId }: ClientDocumentManagerDialogProps) {
  const { data: client, isLoading } = useClientQuery(clientId ?? '');
  const uploadMutation = useUploadClientDocumentMutation();
  const deleteMutation = useDeleteClientDocumentMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documentToDelete, setDocumentToDelete] = useState<ClientDocument | null>(null);
  const [pendingType, setPendingType] = useState<ClientDocumentType>('ID_CARD');
  const [pendingExpiry, setPendingExpiry] = useState('');

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !clientId) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Seules les images JPEG, PNG ou WEBP sont autorisées.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Le fichier dépasse la taille maximale autorisée (5 Mo).');
      return;
    }

    uploadMutation.mutate(
      { clientId, file, type: pendingType, expiryDate: pendingExpiry || undefined },
      {
        onSuccess: () => toast.success('Document ajouté.'),
        onError: (err) => toast.error(errorMessage(err, "Erreur lors de l'envoi du document.")),
      },
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Documents{client ? ` — ${client.firstName} ${client.lastName}` : ''}
            </DialogTitle>
            <DialogDescription>Formats acceptés : JPEG, PNG, WEBP. Taille maximale : 5 Mo.</DialogDescription>
          </DialogHeader>

          {isLoading && <LoadingState message="Chargement des documents..." />}

          {client && (
            <div className="space-y-4">
              {client.documents.length === 0 ? (
                <EmptyState
                  icon={FileX}
                  title="Aucun document"
                  description="Ajoutez une pièce d'identité, un permis ou un passeport."
                />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {client.documents.map((document) => (
                    <div key={document.id} className="relative overflow-hidden rounded-lg border border-border">
                      <img src={document.url} alt="" className="h-32 w-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-background/90 px-2 py-1 text-xs font-medium">
                        {CLIENT_DOCUMENT_TYPE_LABELS[document.type]}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute right-2 top-2 h-7 w-7"
                            aria-label="Actions sur le document"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <a href={document.url} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-4 w-4" />
                              Voir
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDocumentToDelete(document)}
                          >
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
                <div className="space-y-1.5">
                  <Label>Type de document</Label>
                  <Select value={pendingType} onValueChange={(v) => setPendingType(v as ClientDocumentType)}>
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CLIENT_DOCUMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {CLIENT_DOCUMENT_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Expiration (optionnel)</Label>
                  <Input
                    type="date"
                    value={pendingExpiry}
                    onChange={(e) => setPendingExpiry(e.target.value)}
                    className="w-40"
                  />
                </div>
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
                  Ajouter un document
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(documentToDelete)}
        onOpenChange={(next) => !next && setDocumentToDelete(null)}
        title="Supprimer ce document ?"
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={async () => {
          if (!clientId || !documentToDelete) return;
          try {
            await deleteMutation.mutateAsync({ clientId, documentId: documentToDelete.id });
            toast.success('Document supprimé.');
            setDocumentToDelete(null);
          } catch (err) {
            toast.error(errorMessage(err, 'Erreur lors de la suppression.'));
            throw err;
          }
        }}
      />
    </>
  );
}
