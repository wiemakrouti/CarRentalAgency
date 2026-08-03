import type { ApiResponse } from '@car-rental/shared';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

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
