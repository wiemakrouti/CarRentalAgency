import type { ApiResponse } from '@car-rental/shared';
import { getAccessToken, refreshAccessToken } from './auth-session';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

// Paths whose own 401 must never trigger a silent-refresh retry: a bad
// /auth/login attempt isn't fixed by refreshing, and /auth/refresh retrying
// itself would recurse forever.
const NO_RETRY_PATHS = ['/auth/login', '/auth/refresh'];

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit, isRetry = false): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });

  if (res.status === 401 && !isRetry && !NO_RETRY_PATHS.includes(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, init, true);
    }
  }

  const body = (await res.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new ApiClientError(body.error.code, body.error.message);
  }

  return body.data;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
