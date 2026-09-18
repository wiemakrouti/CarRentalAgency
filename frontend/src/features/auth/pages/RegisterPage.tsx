import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { CarFront, Loader2, MailCheck } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@car-rental/shared';

import { authApi } from '@/features/auth/api/auth.api';
import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Creates a brand new agency (tenant) plus its admin — always available, like
// any SaaS signup, not gated on any "first run" state (see
// AuthService.register). Deliberately does NOT log the admin in: email
// verification is blocking (see AuthService.login), so this ends on a
// "check your email" screen, not the dashboard.
export function RegisterPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(input: RegisterInput) {
    setFormError(null);
    try {
      const result = await authApi.register(input);
      setRegisteredEmail(result.email);
    } catch (err) {
      setFormError(
        err instanceof ApiClientError
          ? err.message
          : 'Une erreur est survenue. Veuillez réessayer.',
      );
    }
  }

  async function handleResend() {
    if (!registeredEmail) return;
    try {
      await authApi.resendVerification({ email: registeredEmail });
      setResent(true);
    } catch {
      // Best-effort — the endpoint never signals failure meaningfully here
      // (same non-enumeration shape as forgot-password), nothing to show.
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background:
          'radial-gradient(ellipse 800px 500px at 50% -10%, hsl(var(--primary-50)), transparent), hsl(var(--background))',
      }}
    >
      <Card className="w-full max-w-sm shadow-elevation">
        <CardHeader className="items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground shadow-sm">
            <CarFront className="h-5 w-5" />
          </div>
          <CardTitle className="mt-2 text-xl">
            {registeredEmail ? 'Vérifiez votre email' : 'Créer votre agence'}
          </CardTitle>
          {!registeredEmail && (
            <CardDescription>
              Configurez votre espace et votre compte administrateur.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {registeredEmail ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <MailCheck className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                Un email de confirmation a été envoyé à <strong>{registeredEmail}</strong>. Cliquez
                sur le lien qu'il contient pour activer votre compte.
              </p>
              <Button variant="outline" className="w-full" disabled={resent} onClick={handleResend}>
                {resent ? 'Email renvoyé' : "Renvoyer l'email"}
              </Button>
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
                <Label htmlFor="agencyName">Nom de l'agence</Label>
                <Input
                  id="agencyName"
                  autoComplete="organization"
                  placeholder="Ex: Tunis Auto Location"
                  {...register('agencyName')}
                />
                {errors.agencyName && (
                  <p className="text-sm text-destructive">{errors.agencyName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input
                  id="fullName"
                  autoComplete="name"
                  placeholder="Ex: Ahmed Ben Salah"
                  {...register('fullName')}
                />
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName.message}</p>
                )}
              </div>

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
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
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
                Créer le compte
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Déjà inscrit ?{' '}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Se connecter
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default RegisterPage;
