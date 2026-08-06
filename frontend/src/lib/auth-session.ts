import type { ApiResponse } from '@car-rental/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

// Deliberately not exported via apiClient: apiClient itself needs to call
// this on a 401 to retry the original request, and importing apiClient here
// would create a circular dependency. This module owns the in-memory access
// token (never localStorage — see docs/design-system.md "Known deferrals" /
// Phase 1b decision log) and the raw refresh call, nothing else.

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Lets apiClient tell AuthProvider "the session is truly dead" from anywhere
// a request fails after an unsuccessful silent refresh — not just the
// initial page load. Matters once background queries (TanStack Query
// refetch-on-focus, etc.) can hit a 401 long after the app has mounted.
type SessionListener = () => void;
const sessionExpiredListeners = new Set<SessionListener>();

export function onSessionExpired(listener: SessionListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

export function notifySessionExpired(): void {
  sessionExpiredListeners.forEach((listener) => listener());
}

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function performRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      setAccessToken(null);
      return null;
    }

    const body = (await res.json()) as ApiResponse<{ accessToken: string }>;
    if (!body.success) {
      setAccessToken(null);
      return null;
    }

    setAccessToken(body.data.accessToken);
    return body.data.accessToken;
  } catch {
    setAccessToken(null);
    return null;
  }
}
