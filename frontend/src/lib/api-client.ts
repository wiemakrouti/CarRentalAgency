import type { ApiResponse, ApiSuccess } from '@car-rental/shared';
import { getAccessToken, notifySessionExpired, refreshAccessToken } from './auth-session';

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

async function requestRaw<T>(
  path: string,
  init?: RequestInit,
  isRetry = false,
): Promise<ApiSuccess<T>> {
  const token = getAccessToken();
  const isFormData = init?.body instanceof FormData;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      // Omit Content-Type for FormData so the browser sets the multipart
      // boundary itself — setting it manually breaks multer's parsing.
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });

  if (res.status === 401 && !isRetry && !NO_RETRY_PATHS.includes(path)) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return requestRaw<T>(path, init, true);
    }
    notifySessionExpired();
  }

  const body = (await res.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new ApiClientError(body.error.code, body.error.message);
  }

  return body;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const body = await requestRaw<T>(path, init);
  return body.data;
}

async function requestPaginated<T>(
  path: string,
): Promise<{ items: T[]; meta: NonNullable<ApiSuccess<T[]>['meta']> }> {
  const body = await requestRaw<T[]>(path);
  return { items: body.data, meta: body.meta! };
}

// Export endpoints return a raw file body (CSV, later maybe PDF), not the
// {success,data} envelope every other endpoint uses — apiClient.get can't
// parse that as JSON, so downloads get their own path: fetch as a blob and
// hand the browser a real file save instead of navigating to it (a plain
// <a href> can't carry the Authorization header this API requires).
async function download(path: string, isRetry = false): Promise<Blob> {
  const token = getAccessToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401 && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) return download(path, true);
    notifySessionExpired();
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
    throw new ApiClientError(
      body && !body.success ? body.error.code : 'DOWNLOAD_FAILED',
      body && !body.success ? body.error.message : 'Le téléchargement a échoué.',
    );
  }

  return res.blob();
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  getPaginated: <T>(path: string) => requestPaginated<T>(path),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  postForm: <T>(path: string, formData: FormData) =>
    request<T>(path, { method: 'POST', body: formData }),
  patch: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: 'PATCH', body: data ? JSON.stringify(data) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  download,
};
