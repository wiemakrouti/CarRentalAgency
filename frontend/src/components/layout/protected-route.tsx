import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/providers/auth-provider';
import { LoadingState } from '@/components/common/loading-state';

export function ProtectedRoute() {
  const { status } = useAuth();
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

  return <Outlet />;
}
