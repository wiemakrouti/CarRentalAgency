import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CarFront, Loader2 } from 'lucide-react';
import { loginSchema, type LoginInput } from '@car-rental/shared';

import { useAuth } from '@/providers/auth-provider';
import { authApi } from '@/features/auth/api/auth.api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  // Set only for EMAIL_NOT_VERIFIED — lets the form offer a direct "resend"
  // action instead of just a dead-end error message.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  async function onSubmit(input: LoginInput) {
    setFormError(null);
    setUnverifiedEmail(null);
    setResent(false);
    try {
      await login(input);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(input.email);
        setFormError(err.message);
        return;
      }
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : 'Une erreur est survenue. Veuillez réessayer.',
      );
    }
  }

  async function handleResend() {
    if (!unverifiedEmail) return;
    try {
      await authApi.resendVerification({ email: unverifiedEmail });
      setResent(true);
    } catch {
      // Best-effort, same non-enumeration shape as forgot-password —
      // nothing meaningful to show on failure.
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground shadow-sm">
            <CarFront className="h-5 w-5" />
          </div>
          <CardTitle className="mt-2 text-xl">Connexion</CardTitle>
          <CardDescription>Pilotez votre agence de location en toute simplicité.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {formError}
                  {unverifiedEmail && (
                    <Button
                      type="button"
                      variant="link"
                      className="ml-1 h-auto p-0 text-destructive underline"
                      disabled={resent}
                      onClick={handleResend}
                    >
                      {resent ? 'Email renvoyé' : "Renvoyer l'email"}
                    </Button>
                  )}
                </AlertDescription>
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

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register('password')}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
              <div className="text-right">
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Nouvelle agence ?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Créez votre espace
            </Link>
          </p>
        </CardContent>
      </div>
    </AuthLayout>
  );
}

export default LoginPage;
