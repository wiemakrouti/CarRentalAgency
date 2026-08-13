import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ALLOWED_IMAGE_TYPES, validateCarImageFile } from '../lib/car-image-validation';

type CarPhotoFieldProps = {
  // The car's current primary image (edit mode only) — shown until the admin
  // picks a replacement. Never mutated directly by this field: the actual
  // upload/replace only happens on form submit, via the existing Cars image
  // API (CarFormDialog does that, not this component).
  existingImageUrl?: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

// Upload UI only — no network calls here. CarFormDialog owns when the
// selected file actually gets sent (after create, or on edit save), reusing
// the same upload endpoint the image manager already uses. This is
// deliberately just a picker + preview, not a second image-management
// system.
export function CarPhotoField({
  existingImageUrl,
  file,
  onFileChange,
  disabled,
}: CarPhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Object URLs must be revoked or they leak for the page's lifetime — swap
  // it out (and free the old one) whenever the selected file changes.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function selectFile(candidate: File | undefined) {
    if (!candidate) return;
    const validationError = validateCarImageFile(candidate);
    if (validationError) {
      setError(validationError);
      onFileChange(null);
      return;
    }
    setError(null);
    onFileChange(candidate);
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = '';
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    selectFile(event.dataTransfer.files?.[0]);
  }

  function handleRemove(event: React.MouseEvent) {
    event.stopPropagation();
    setError(null);
    onFileChange(null);
  }

  const displayUrl = previewUrl ?? existingImageUrl ?? null;

  return (
    <div className="space-y-2">
      <Label htmlFor="carPhoto">Photo de la voiture</Label>
      <input
        ref={inputRef}
        id="carPhoto"
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(',')}
        className="hidden"
        disabled={disabled}
        onChange={handleInputChange}
      />

      {displayUrl ? (
        <div className="group relative h-40 w-full overflow-hidden rounded-lg border border-border">
          <img src={displayUrl} alt="Aperçu de la voiture" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Changer
            </Button>
            {file && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={disabled}
                onClick={handleRemove}
              >
                <X className="h-3.5 w-3.5" />
                Retirer
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'flex h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-center transition-colors',
            !disabled && 'cursor-pointer hover:border-primary/50 hover:bg-accent/50',
            isDragOver && 'border-primary bg-accent/50',
            disabled && 'opacity-50',
          )}
        >
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cliquez ou glissez-déposez une image</p>
          <p className="text-xs text-muted-foreground">JPEG, PNG ou WEBP — 5 Mo max</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
