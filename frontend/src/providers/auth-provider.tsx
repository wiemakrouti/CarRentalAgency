import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LoginInput } from '@car-rental/shared';
import { authApi, type AuthUser } from '@/features/auth/api/auth.api';
import { queryClient } from '@/lib/query-client';
import {
  getAccessToken,
  onSessionExpired,
  refreshAccessToken,
  setAccessToken,
} from '@/lib/auth-session';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = await refreshAccessToken();
      if (cancelled) return;

      if (!token) {
        setStatus('unauthenticated');
        return;
      }

      try {
        const me = await authApi.me();
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (!cancelled) {
          setAccessToken(null);
          setStatus('unauthenticated');
        }
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return onSessionExpired(() => {
      queryClient.clear();
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
    });
  }, []);

  async function login(input: LoginInput) {
    const result = await authApi.login(input);
    // Every cached query (Settings, Cars, Clients, ...) is scoped to whoever
    // was previously signed in in this tab — a different account, possibly a
    // different agency entirely, must never render from that stale cache
    // even for a moment before its own queries refetch.
    queryClient.clear();
    setAccessToken(result.accessToken);
    setUser(result.user);
    setStatus('authenticated');
  }

  async function logout() {
    try {
      if (getAccessToken()) {
        await authApi.logout();
      }
    } finally {
      queryClient.clear();
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  }

  return (
    <AuthContext.Provider value={{ user, status, login, logout, updateUser: setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
