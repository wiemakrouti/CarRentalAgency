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
import type { Expense } from '../api/finances.api';
import { useArchiveExpenseMutation, useRestoreExpenseMutation } from '../hooks/use-expenses';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

type ExpenseRowActionsProps = {
  expense: Expense;
  onEdit: (expense: Expense) => void;
};

export function ExpenseRowActions({ expense, onEdit }: ExpenseRowActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const archiveMutation = useArchiveExpenseMutation();
  const restoreMutation = useRestoreExpenseMutation();
  const isArchived = Boolean(expense.deletedAt);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(expense)}>Modifier</DropdownMenuItem>
          {isArchived ? (
            <DropdownMenuItem
              onClick={() =>
                restoreMutation.mutate(expense.id, {
                  onSuccess: () => toast.success('Dépense restaurée.'),
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
        title="Archiver cette dépense ?"
        description="Cette dépense sera archivée. Vous pourrez la restaurer plus tard."
        confirmLabel="Archiver"
        variant="destructive"
        onConfirm={async () => {
          try {
            await archiveMutation.mutateAsync(expense.id);
            toast.success('Dépense archivée.');
          } catch (err) {
            toast.error(errorMessage(err, "Erreur lors de l'archivage."));
            throw err;
          }
        }}
      />
    </>
  );
}
