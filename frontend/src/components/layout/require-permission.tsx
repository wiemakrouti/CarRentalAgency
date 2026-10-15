import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import type { Permission } from '@car-rental/shared';

import { useCan } from '@/hooks/use-can';

// Keeps a page to the members allowed to use it; anyone else lands back on
// the dashboard. Only a convenience — the API refuses those requests itself.
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const allowed = useCan(permission);
  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
