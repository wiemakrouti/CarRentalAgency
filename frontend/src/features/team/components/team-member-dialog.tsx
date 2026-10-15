import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createEmployeeSchema, type CreateEmployeeInput } from '@car-rental/shared';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import type { TeamMember } from '../api/team.api';
import { useCreateEmployeeMutation, useUpdateEmployeeMutation } from '../hooks/use-team';
import { generateTemporaryPassword } from '../lib/temporary-password';
import { TemporaryPasswordField } from './temporary-password-field';

type TeamMemberDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Editing an existing employee; omitted to add a new one.
  member?: TeamMember | null;
};

// Editing reuses the creation schema with a placeholder password: the field
// isn't shown (a password is reset separately) but keeps one schema for both.
const EDIT_PASSWORD_PLACEHOLDER = 'unchanged-placeholder';

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiClientError ? err.message : fallback;
}

// Adds an employee (name, email, temporary password to hand over) or edits
// one's name and email.
export function TeamMemberDialog({ open, onOpenChange, member }: TeamMemberDialogProps) {
  const isEdit = Boolean(member);
  const createMutation = useCreateEmployeeMutation();
  const updateMutation = useUpdateEmployeeMutation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmployeeInput>({ resolver: zodResolver(createEmployeeSchema) });

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    reset({
      fullName: member?.fullName ?? '',
      email: member?.email ?? '',
      temporaryPassword: member ? EDIT_PASSWORD_PLACEHOLDER : generateTemporaryPassword(),
    });
  }, [open, member, reset]);

  async function onSubmit(input: CreateEmployeeInput) {
    setFormError(null);
    try {
      if (member) {
        await updateMutation.mutateAsync({ id: member.id, input: { fullName: input.fullName, email: input.email } });
        toast.success('Employé mis à jour.');
      } else {
        await createMutation.mutateAsync(input);
        toast.success(`Compte créé. Donnez le mot de passe provisoire à ${input.fullName}.`);
      }
      onOpenChange(false);
    } catch (err) {
      setFormError(errorMessage(err, 'Une erreur est survenue. Veuillez réessayer.'));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Modifier l’employé' : 'Ajouter un employé'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Le nom et l’adresse email avec laquelle il se connecte.'
              : 'Créez un accès personnel pour un membre de votre équipe.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="team-fullName" required>
              Nom complet
            </Label>
            <Input id="team-fullName" autoComplete="off" {...register('fullName')} />
            {errors.fullName && <p className="text-sm text-destructive">{errors.fullName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="team-email" required>
              Email
            </Label>
            <Input id="team-email" type="email" autoComplete="off" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="team-password" required>
                Mot de passe provisoire
              </Label>
              <TemporaryPasswordField
                id="team-password"
                {...register('temporaryPassword')}
                value={watch('temporaryPassword') ?? ''}
                onGenerate={(password) => setValue('temporaryPassword', password, { shouldValidate: true })}
              />
              {errors.temporaryPassword && (
                <p className="text-sm text-destructive">{errors.temporaryPassword.message}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? 'Enregistrer' : 'Créer le compte'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
