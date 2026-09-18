import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { CarFront, Loader2, Upload, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { Settings } from '@/features/settings/api/settings.api';
import { toSettingsFormValues } from '@/features/settings/lib/settings-form';
import {
  useUpdateSettingsMutation,
  useUploadLogoMutation,
} from '@/features/settings/hooks/use-settings';

import { ALLOWED_LOGO_TYPES, validateLogoFile } from '../lib/logo-validation';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

type AgencyLogoFieldProps = {
  settings: Settings;
  onUpdated: (settings: Settings) => void;
  // 'vertical' stacks the avatar above centered buttons, for the identity
  // sidebar on ProfilePage; 'horizontal' (default) keeps the original
  // avatar-beside-buttons row.
  layout?: 'horizontal' | 'vertical';
};

// Uploads immediately on selection (unlike CarPhotoField, which only stages
// a file for CarFormDialog to send on submit) — there's no "create" step to
// wait for here, Settings is an already-persisted singleton row, so there's
// nothing gained by deferring the network call to a separate form submit.
export function AgencyLogoField({
  settings,
  onUpdated,
  layout = 'horizontal',
}: AgencyLogoFieldProps) {
  const isVertical = layout === 'vertical';
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const uploadMutation = useUploadLogoMutation();
  const removeMutation = useUpdateSettingsMutation();
  const busy = uploadMutation.isPending || removeMutation.isPending;

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    const validationError = validateLogoFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      const updated = await uploadMutation.mutateAsync(file);
      onUpdated(updated);
      toast.success('Logo mis à jour.');
    } catch (err) {
      toast.error(errorMessage(err, "Erreur lors de l'envoi du logo."));
    }
  }

  async function handleRemove() {
    try {
      const updated = await removeMutation.mutateAsync({
        ...toSettingsFormValues(settings),
        logoUrl: null,
      });
      onUpdated(updated);
      toast.success('Logo supprimé.');
    } catch (err) {
      toast.error(errorMessage(err, 'Erreur lors de la suppression du logo.'));
    }
  }

  return (
    <div className={cn('space-y-2', isVertical && 'space-y-0')}>
      {!isVertical && <Label htmlFor="agencyLogo">Logo</Label>}
      <input
        ref={inputRef}
        id="agencyLogo"
        type="file"
        accept={ALLOWED_LOGO_TYPES.join(',')}
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className={cn('flex items-center gap-4', isVertical && 'flex-col gap-3')}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !busy && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground shadow-md shadow-primary/30 transition-shadow',
            isVertical ? 'h-20 w-20' : 'h-16 w-16',
            isDragOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            busy && 'cursor-not-allowed opacity-70',
          )}
        >
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <CarFront className={isVertical ? 'h-9 w-9' : 'h-7 w-7'} />
          )}
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader2 className="h-5 w-5 animate-spin text-white" />
            </div>
          )}
        </div>
        <div className={cn('flex flex-col gap-1.5', isVertical && 'items-center')}>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              Changer le logo
            </Button>
            {settings.logoUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={busy}
                onClick={handleRemove}
              >
                <X className="h-3.5 w-3.5" />
                Retirer
              </Button>
            )}
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
