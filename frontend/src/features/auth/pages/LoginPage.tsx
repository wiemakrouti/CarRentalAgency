import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { CarFront, Loader2 } from 'lucide-react';
import { loginSchema, type LoginInput } from '@car-rental/shared';

import { useAuth } from '@/providers/auth-provider';
import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  async function onSubmit(input: LoginInput) {
    setFormError(null);
    try {
      await login(input);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setFormError(
        err instanceof ApiClientError ? err.message : 'Une erreur est survenue. Veuillez réessayer.',
      );
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm shadow-elevation">
        <CardHeader className="items-center text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CarFront className="h-5 w-5" />
          </div>
          <CardTitle className="mt-2 text-xl">Connexion</CardTitle>
          <CardDescription>Accédez à votre tableau de bord de gestion.</CardDescription>
        </CardHeader>
        <CardContent>
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
                placeholder="admin@agence.tn"
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
              {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default LoginPage;
