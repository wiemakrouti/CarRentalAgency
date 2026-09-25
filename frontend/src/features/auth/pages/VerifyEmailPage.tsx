import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CarFront, CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { authApi } from '@/features/auth/api/auth.api';
import { AuthLayout } from '@/features/auth/components/auth-layout';
import { ApiClientError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Status = 'verifying' | 'success' | 'error';

// Verification is blocking (see AuthService.login) — nobody reaches this
// page with a live session (registering no longer logs the admin in, and a
// login attempt before verifying is rejected outright), so there is no auth
// state to patch here, only a plain "Se connecter" link once this succeeds.
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  // StrictMode double-invokes effects in dev — a token is single-use, so a
  // second real request would just fail as "invalid or expired" and flip a
  // just-succeeded screen to an error. Guards against that, not against a
  // genuine remount.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('Ce lien de vérification est invalide.');
      return;
    }
    if (attempted.current) return;
    attempted.current = true;

    authApi
      .verifyEmail({ token })
      .then(() => setStatus('success'))
      .catch((err) => {
        setStatus('error');
        setErrorMessage(
          err instanceof ApiClientError
            ? err.message
            : 'Une erreur est survenue. Veuillez réessayer.',
        );
      });
  }, [token]);

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground shadow-sm">
            <CarFront className="h-5 w-5" />
          </div>
          <CardTitle className="mt-2 text-xl">Vérification de l'email</CardTitle>
          {status === 'verifying' && <CardDescription>Vérification en cours...</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            {status === 'verifying' && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            {status === 'success' && (
              <>
                <CheckCircle2 className="h-8 w-8 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Votre adresse email est vérifiée. Vous pouvez maintenant vous connecter.
                </p>
              </>
            )}
            {status === 'error' && (
              <>
                <XCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-muted-foreground">{errorMessage}</p>
              </>
            )}

            {status !== 'verifying' && (
              <Button asChild className="w-full">
                <Link to="/login">Se connecter</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </div>
    </AuthLayout>
  );
}

export default VerifyEmailPage;
