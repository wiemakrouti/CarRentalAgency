import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { toast } from 'sonner';
import { Copy, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';

import { generateTemporaryPassword } from '../lib/temporary-password';

type TemporaryPasswordFieldProps = ComponentPropsWithoutRef<typeof PasswordInput> & {
  onGenerate: (password: string) => void;
};

// Masked like any password, with the eye to show it and a button to copy it
// — the director has to hand it over. The employee replaces it at their first
// login anyway.
export const TemporaryPasswordField = forwardRef<HTMLInputElement, TemporaryPasswordFieldProps>(
  function TemporaryPasswordField({ onGenerate, ...props }, ref) {
    async function copy() {
      const value = String(props.value ?? '');
      if (!value) return;
      try {
        await navigator.clipboard.writeText(value);
        toast.success('Mot de passe copié.');
      } catch {
        toast.error('Impossible de copier automatiquement.');
      }
    }

    return (
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <PasswordInput ref={ref} autoComplete="new-password" spellCheck={false} className="font-mono" {...props} />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Générer un mot de passe"
          title="Générer"
          onClick={() => onGenerate(generateTemporaryPassword())}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Copier le mot de passe" title="Copier" onClick={copy}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    );
  },
);
