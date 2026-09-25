import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CarFront, CheckCircle2, Loader2 } from 'lucide-react';
import { resetPasswordSchema, type ResetPasswordInput } from '@car-rental/shared';

import { authApi } from '@/features/auth/api/auth.api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(input: ResetPasswordInput) {
    setFormError(null);
    try {
      await authApi.resetPassword(input);
      setDone(true);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : 'Une erreur est survenue. Veuillez réessayer.',
      );
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground shadow-sm">
            <CarFront className="h-5 w-5" />
          </div>
          <CardTitle className="mt-2 text-xl">Nouveau mot de passe</CardTitle>
          <CardDescription>Choisissez un nouveau mot de passe pour votre compte.</CardDescription>
        </CardHeader>
        <CardContent>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <CheckCircle2 className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                Votre mot de passe a été réinitialisé. Vous pouvez maintenant vous connecter.
              </p>
              <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>
                Se connecter
              </Button>
            </div>
          ) : !token ? (
            <Alert variant="destructive">
              <AlertDescription>
                Ce lien de réinitialisation est invalide.{' '}
                <Link to="/forgot-password" className="font-medium underline">
                  Demander un nouveau lien
                </Link>
                .
              </AlertDescription>
            </Alert>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <input type="hidden" {...register('token')} />

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  {...register('newPassword')}
                />
                {errors.newPassword && (
                  <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Réinitialiser le mot de passe
              </Button>
            </form>
          )}
        </CardContent>
      </div>
    </AuthLayout>
  );
}

export default ResetPasswordPage;
