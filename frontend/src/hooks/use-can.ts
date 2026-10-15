import { can, type Permission } from '@car-rental/shared';

import { useAuth } from '@/providers/auth-context';

// Whether the signed-in member may perform an action — read from the same
// shared PERMISSIONS list the API enforces. Only hides what a role can't
// use; the API refuses it regardless.
export function useCan(permission: Permission): boolean {
  const { user } = useAuth();
  return can(user?.role, permission);
}
