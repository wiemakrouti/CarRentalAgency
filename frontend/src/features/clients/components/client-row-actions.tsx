import { useState } from 'react';
import { CalendarDays, MoreHorizontal } from 'lucide-react';
import { toast } from 'sonner';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { Client } from '../api/clients.api';
import { useClientDeletableQuery, useDeleteClientMutation } from '../hooks/use-clients';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

type ClientRowActionsProps = {
  client: Client;
  onEdit: (client: Client) => void;
  onManageDocuments: (client: Client) => void;
  onViewProfile: (client: Client) => void;
  onOpenCalendar: (client: Client) => void;
};

// Client has no soft-delete (see docs/architecture.md § Soft delete) — same
// guarded hard-delete pattern as CarRowActions: a precheck query drives
// whether the confirm dialog shows a destructive confirm or an explanatory
// notice, instead of only finding out after submitting.
export function ClientRowActions({
  client,
  onEdit,
  onManageDocuments,
  onViewProfile,
  onOpenCalendar,
}: ClientRowActionsProps) {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteMutation = useDeleteClientMutation();
  const deletableQuery = useClientDeletableQuery(client.id, confirmDeleteOpen);
  const blocked = deletableQuery.data?.canDelete === false;

  return (
    <>
      <div className="flex items-center justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Calendrier des locations"
              onClick={() => onOpenCalendar(client)}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Calendrier des locations</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewProfile(client)}>Voir la fiche</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(client)}>Modifier</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onManageDocuments(client)}>Gérer les documents</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDeleteOpen(true)}>
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {blocked ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Suppression impossible"
          description={
            deletableQuery.data?.reason ??
            'Ce client a un historique de locations et ne peut pas être supprimé définitivement.'
          }
          confirmLabel="Compris"
          onConfirm={() => {
            /* Nothing to do — informational only, closes the dialog. */
          }}
        />
      ) : (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Supprimer définitivement ce client ?"
          description={`${client.firstName} ${client.lastName} sera supprimé définitivement. Cette action est irréversible.`}
          confirmLabel="Supprimer"
          variant="destructive"
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(client.id);
              toast.success('Client supprimé définitivement.');
            } catch (err) {
              // CLIENT_HAS_HISTORY isn't a failure — it's the guard working as
              // intended (e.g. the precheck above raced with a new rental).
              // Gets its own toast instead of reading like a generic error.
              if (err instanceof ApiClientError && err.code === 'CLIENT_HAS_HISTORY') {
                toast.warning(err.message);
              } else {
                toast.error(errorMessage(err, 'Erreur lors de la suppression.'));
              }
              throw err;
            }
          }}
        />
      )}
    </>
  );
}
