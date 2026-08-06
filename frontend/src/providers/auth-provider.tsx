import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { LoginInput } from '@car-rental/shared';
import { authApi, type AuthUser } from '@/features/auth/api/auth.api';
import { getAccessToken, onSessionExpired, refreshAccessToken, setAccessToken } from '@/lib/auth-session';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
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
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
    });
  }, []);

  async function login(input: LoginInput) {
    const result = await authApi.login(input);
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
      setAccessToken(null);
      setUser(null);
      setStatus('unauthenticated');
    }
  }

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
