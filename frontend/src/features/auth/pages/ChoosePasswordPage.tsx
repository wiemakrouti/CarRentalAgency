import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CarFront, Loader2 } from 'lucide-react';
import { changePasswordSchema, type ChangePasswordInput } from '@car-rental/shared';

import { authApi } from '@/features/auth/api/auth.api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/providers/auth-context';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';

// Shown instead of the whole app while the account still runs on the
// temporary password the director gave (User.mustChangePassword) — the API
// refuses everything else until then. Changing the password ends every
// session, so the new one is used to sign straight back in.
export function ChoosePasswordPage() {
  const { user, login, logout } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(input: ChangePasswordInput) {
    setFormError(null);
    try {
      await authApi.changePassword(input);
      if (user) await login({ email: user.email, password: input.newPassword });
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Une erreur est survenue. Veuillez réessayer.');
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground shadow-sm">
            <CarFront className="h-5 w-5" />
          </div>
          <CardTitle className="mt-2 text-xl">Choisissez votre mot de passe</CardTitle>
          <CardDescription>
            Bienvenue{user ? ` ${user.fullName.split(' ')[0]}` : ''} ! Remplacez le mot de passe provisoire reçu par un
            mot de passe personnel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Mot de passe provisoire</Label>
              <PasswordInput id="currentPassword" autoComplete="current-password" {...register('currentPassword')} />
              {errors.currentPassword && <p className="text-sm text-destructive">{errors.currentPassword.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <PasswordInput id="newPassword" autoComplete="new-password" {...register('newPassword')} />
              {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <PasswordInput id="confirmPassword" autoComplete="new-password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Enregistrer et continuer
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => logout()}>
              Se déconnecter
            </Button>
          </form>
        </CardContent>
      </div>
    </AuthLayout>
  );
}
