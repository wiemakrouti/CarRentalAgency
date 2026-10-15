import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { resetEmployeePasswordSchema, type ResetEmployeePasswordInput } from '@car-rental/shared';

import { ApiClientError } from '@/lib/api-client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

import type { TeamMember } from '../api/team.api';
import { useResetEmployeePasswordMutation } from '../hooks/use-team';
import { generateTemporaryPassword } from '../lib/temporary-password';
import { TemporaryPasswordField } from './temporary-password-field';

type ResetPasswordDialogProps = {
  member: TeamMember | null;
  onOpenChange: (open: boolean) => void;
};

// An employee forgot their password: the director sets a new temporary one.
// The employee is signed out everywhere and picks their own at next login.
export function ResetPasswordDialog({ member, onOpenChange }: ResetPasswordDialogProps) {
  const mutation = useResetEmployeePasswordMutation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetEmployeePasswordInput>({ resolver: zodResolver(resetEmployeePasswordSchema) });

  useEffect(() => {
    if (!member) return;
    setFormError(null);
    reset({ temporaryPassword: generateTemporaryPassword() });
  }, [member, reset]);

  async function onSubmit(input: ResetEmployeePasswordInput) {
    if (!member) return;
    setFormError(null);
    try {
      await mutation.mutateAsync({ id: member.id, input });
      toast.success(`Mot de passe réinitialisé. Donnez le nouveau mot de passe à ${member.fullName}.`);
      onOpenChange(false);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue. Veuillez réessayer.');
    }
  }

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            {member?.fullName} sera déconnecté et devra choisir son propre mot de passe à sa prochaine connexion.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="reset-password" required>
              Nouveau mot de passe provisoire
            </Label>
            <TemporaryPasswordField
              id="reset-password"
              {...register('temporaryPassword')}
              value={watch('temporaryPassword') ?? ''}
              onGenerate={(password) => setValue('temporaryPassword', password, { shouldValidate: true })}
            />
            {errors.temporaryPassword && (
              <p className="text-sm text-destructive">{errors.temporaryPassword.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
