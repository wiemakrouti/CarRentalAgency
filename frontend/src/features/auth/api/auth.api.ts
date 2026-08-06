import type { LoginInput, Role } from '@car-rental/shared';
import { apiClient } from '@/lib/api-client';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export const authApi = {
  login: (input: LoginInput) => apiClient.post<LoginResponse>('/auth/login', input),
  logout: () => apiClient.post<{ loggedOut: boolean }>('/auth/logout'),
  me: () => apiClient.get<AuthUser>('/auth/me'),
};
