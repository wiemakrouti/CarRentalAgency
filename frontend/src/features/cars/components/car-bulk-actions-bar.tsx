import { useState } from 'react';
import { toast } from 'sonner';
import { CAR_STATUSES, type CarStatus } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useBulkArchiveCarsMutation, useBulkUpdateCarStatusMutation } from '../hooks/use-cars';
import { CAR_STATUS_LABELS } from '../lib/car-labels';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

type CarBulkActionsBarProps = {
  selectedIds: string[];
  onClearSelection: () => void;
};

// Table view only — bulk selection doesn't extend to the grid, which is a
// browse-oriented view rather than a data-management one.
export function CarBulkActionsBar({ selectedIds, onClearSelection }: CarBulkActionsBarProps) {
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const bulkArchiveMutation = useBulkArchiveCarsMutation();
  const bulkStatusMutation = useBulkUpdateCarStatusMutation();

  if (selectedIds.length === 0) return null;

  function handleStatusChange(status: CarStatus) {
    bulkStatusMutation.mutate(
      { ids: selectedIds, status },
      {
        onSuccess: () => {
          toast.success(`Statut mis à jour pour ${selectedIds.length} voiture(s).`);
          onClearSelection();
        },
        onError: (err) =>
          toast.error(errorMessage(err, 'Erreur lors de la mise à jour du statut.')),
      },
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
      <span className="text-sm font-medium">{selectedIds.length} sélectionnée(s)</span>

      <Select onValueChange={(value) => handleStatusChange(value as CarStatus)}>
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="Changer le statut..." />
        </SelectTrigger>
        <SelectContent>
          {CAR_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {CAR_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        className="text-destructive"
        onClick={() => setConfirmArchiveOpen(true)}
      >
        Archiver
      </Button>

      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClearSelection}>
        Désélectionner
      </Button>

      <ConfirmDialog
        open={confirmArchiveOpen}
        onOpenChange={setConfirmArchiveOpen}
        title={`Archiver ${selectedIds.length} voiture(s) ?`}
        description="Ces voitures seront archivées. Vous pourrez les restaurer plus tard."
        confirmLabel="Archiver"
        variant="destructive"
        onConfirm={async () => {
          try {
            await bulkArchiveMutation.mutateAsync(selectedIds);
            toast.success(`${selectedIds.length} voiture(s) archivée(s).`);
            onClearSelection();
          } catch (err) {
            toast.error(errorMessage(err, "Erreur lors de l'archivage groupé."));
            throw err;
          }
        }}
      />
    </div>
  );
}
