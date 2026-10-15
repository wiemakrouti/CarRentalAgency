import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/providers/auth-context';
import { LoadingState } from '@/components/common/loading-state';
import { ChoosePasswordPage } from '@/features/auth/pages/ChoosePasswordPage';

export function ProtectedRoute() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState message="Vérification de la session..." />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // An account still on the director's temporary password sees nothing else
  // until it picks its own (the API refuses everything else anyway).
  if (user?.mustChangePassword) {
    return <ChoosePasswordPage />;
  }

  return <Outlet />;
}
