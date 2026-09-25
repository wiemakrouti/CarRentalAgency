import { Fragment, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { Check, CarFront, Loader2, MailCheck } from 'lucide-react';
import { registerSchema, type RegisterInput } from '@car-rental/shared';

import { authApi } from '@/features/auth/api/auth.api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Creates a brand new agency (tenant) plus its admin — always available, like
// any SaaS signup, not gated on any "first run" state (see
// AuthService.register). Deliberately does NOT log the admin in: email
// verification is blocking (see AuthService.login), so this ends on a
// "check your email" screen, not the dashboard.
export function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function handleNext() {
    if (await trigger(['agencyName', 'fullName'])) setStep(2);
  }

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
    <AuthLayout>
      <div className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground shadow-sm">
            <CarFront className="h-5 w-5" />
          </div>
          <CardTitle className="mt-2 text-xl">
            {registeredEmail ? 'Vérifiez votre email' : 'Créer votre agence'}
          </CardTitle>
          {!registeredEmail && (
            <CardDescription>
              {step === 1
                ? "Commençons par le nom de votre agence et votre profil."
                : 'Configurez votre compte administrateur.'}
            </CardDescription>
          )}
          {!registeredEmail && (
            <div className="flex w-full items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="group flex items-center gap-2"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    step === 1
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-primary/15 text-primary group-hover:bg-primary/25'
                  }`}
                >
                  {step > 1 ? <Check className="h-3.5 w-3.5" /> : '1'}
                </span>
                <span
                  className={`text-xs font-medium transition-colors ${
                    step === 1 ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  Agence
                </span>
              </button>

              <span className="mx-3 h-px flex-1 bg-border" />

              <button
                type="button"
                onClick={handleNext}
                className="group flex items-center gap-2"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    step === 2
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/15 group-hover:text-primary'
                  }`}
                >
                  2
                </span>
                <span
                  className={`text-xs font-medium transition-colors ${
                    step === 2 ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  }`}
                >
                  Compte
                </span>
              </button>
            </div>
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

              {step === 1 ? (
                <Fragment key="step1">
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

                  <Button type="button" className="w-full" onClick={handleNext}>
                    Continuer
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    Déjà inscrit ?{' '}
                    <Link to="/login" className="font-medium text-primary hover:underline">
                      Se connecter
                    </Link>
                  </p>
                </Fragment>
              ) : (
                <Fragment key="step2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="ahmed.bensalah@gmail.com"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
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
                </Fragment>
              )}
            </form>
          )}
        </CardContent>
      </div>
    </AuthLayout>
  );
}

export default RegisterPage;
