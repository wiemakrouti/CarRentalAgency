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
import type { Client } from '../api/clients.api';
import { useArchiveClientMutation, useRestoreClientMutation } from '../hooks/use-clients';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

type ClientRowActionsProps = {
  client: Client;
  onEdit: (client: Client) => void;
  onManageDocuments: (client: Client) => void;
};

export function ClientRowActions({ client, onEdit, onManageDocuments }: ClientRowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const archiveMutation = useArchiveClientMutation();
  const restoreMutation = useRestoreClientMutation();
  const isArchived = Boolean(client.deletedAt);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(client)}>Modifier</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onManageDocuments(client)}>Gérer les documents</DropdownMenuItem>
          {isArchived ? (
            <DropdownMenuItem
              onClick={() =>
                restoreMutation.mutate(client.id, {
                  onSuccess: () => toast.success('Client restauré.'),
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

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Archiver ce client ?"
        description={`${client.firstName} ${client.lastName} sera archivé. Vous pourrez le restaurer plus tard.`}
        confirmLabel="Archiver"
        variant="destructive"
        onConfirm={async () => {
          try {
            await archiveMutation.mutateAsync(client.id);
            toast.success('Client archivé.');
          } catch (err) {
            toast.error(errorMessage(err, "Erreur lors de l'archivage."));
            throw err;
          }
        }}
      />
    </>
  );
}
