import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { CarFront, Loader2, MailCheck } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@car-rental/shared';

import { authApi } from '@/features/auth/api/auth.api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(input: ForgotPasswordInput) {
    setFormError(null);
    try {
      await authApi.forgotPassword(input);
      // Same response whether or not the email exists — the backend never
      // reveals which, so the frontend can't either.
      setSent(true);
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
          <CardTitle className="mt-2 text-xl">Mot de passe oublié</CardTitle>
          <CardDescription>
            Indiquez votre email, nous vous enverrons un lien de réinitialisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <MailCheck className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                Si un compte existe avec cette adresse, un email contenant un lien de
                réinitialisation vient de lui être envoyé.
              </p>
              <Link to="/login" className="text-sm font-medium text-primary hover:underline">
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              {formError && (
                <Alert variant="destructive">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="ahmed.bensalah@gmail.com"
                  {...register('email')}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Envoyer le lien
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </div>
    </AuthLayout>
  );
}

export default ForgotPasswordPage;
