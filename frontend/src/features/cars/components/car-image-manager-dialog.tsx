import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageOff, Loader2, MoreHorizontal, Upload } from 'lucide-react';

import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

import type { CarImage } from '../api/cars.api';
import { useCarQuery, useDeleteCarImageMutation, useSetPrimaryImageMutation, useUploadCarImageMutation } from '../hooks/use-cars';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

type CarImageManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carId: string | undefined;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

export function CarImageManagerDialog({ open, onOpenChange, carId }: CarImageManagerDialogProps) {
  const { data: car, isLoading } = useCarQuery(carId ?? '');
  const uploadMutation = useUploadCarImageMutation();
  const deleteMutation = useDeleteCarImageMutation();
  const setPrimaryMutation = useSetPrimaryImageMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageToDelete, setImageToDelete] = useState<CarImage | null>(null);

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !carId) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Seules les images JPEG, PNG ou WEBP sont autorisées.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('Le fichier dépasse la taille maximale autorisée (5 Mo).');
      return;
    }

    const isPrimary = (car?.images.length ?? 0) === 0;
    uploadMutation.mutate(
      { carId, file, isPrimary },
      {
        onSuccess: () => toast.success('Image ajoutée.'),
        onError: (err) => toast.error(errorMessage(err, "Erreur lors de l'envoi de l'image.")),
      },
    );
  }

  function handleSetPrimary(image: CarImage) {
    if (!carId) return;
    setPrimaryMutation.mutate(
      { carId, imageId: image.id },
      {
        onSuccess: () => toast.success('Image principale mise à jour.'),
        onError: (err) => toast.error(errorMessage(err, 'Erreur lors de la mise à jour.')),
      },
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Images{car ? ` — ${car.brand} ${car.model}` : ''}</DialogTitle>
            <DialogDescription>Formats acceptés : JPEG, PNG, WEBP. Taille maximale : 5 Mo.</DialogDescription>
          </DialogHeader>

          {isLoading && <LoadingState message="Chargement des images..." />}

          {car && (
            <div className="space-y-4">
              {car.images.length === 0 ? (
                <EmptyState
                  icon={ImageOff}
                  title="Aucune image"
                  description="Ajoutez une première photo de ce véhicule."
                />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {car.images.map((image) => (
                    <div key={image.id} className="relative overflow-hidden rounded-lg border border-border">
                      <img src={image.url} alt="" className="h-32 w-full object-cover" />
                      {image.isPrimary && (
                        <Badge className="absolute left-2 top-2">Principale</Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="secondary"
                            className="absolute right-2 top-2 h-7 w-7"
                            aria-label="Actions sur l'image"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!image.isPrimary && (
                            <DropdownMenuItem onClick={() => handleSetPrimary(image)}>
                              Définir comme principale
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setImageToDelete(image)}
                          >
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                Ajouter une image
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(imageToDelete)}
        onOpenChange={(next) => !next && setImageToDelete(null)}
        title="Supprimer cette image ?"
        description="Cette action est définitive."
        confirmLabel="Supprimer"
        variant="destructive"
        onConfirm={async () => {
          if (!carId || !imageToDelete) return;
          try {
            await deleteMutation.mutateAsync({ carId, imageId: imageToDelete.id });
            toast.success('Image supprimée.');
            setImageToDelete(null);
          } catch (err) {
            toast.error(errorMessage(err, 'Erreur lors de la suppression.'));
            throw err;
          }
        }}
      />
    </>
  );
}
