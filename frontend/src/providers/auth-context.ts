import { createContext, useContext } from 'react';
import type { LoginInput } from '@car-rental/shared';
import type { AuthUser } from '@/features/auth/api/auth.api';

// Context + hook live apart from AuthProvider so that file exports only a
// component (keeps React Fast Refresh working on it).

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  // Lets a successful profile edit (ProfilePage) refresh the name/email
  // shown in the topbar immediately, without re-fetching /auth/me — the
  // PATCH response already carries the full, up-to-date user.
  updateUser: (user: AuthUser) => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
