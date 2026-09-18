import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
  Role,
  UpdateProfileInput,
  VerifyEmailInput,
} from '@car-rental/shared';
import { apiClient } from '@/lib/api-client';

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  lastLoginAt: string | null;
  createdAt: string;
};

type LoginResponse = {
  accessToken: string;
  user: AuthUser;
};

export type Session = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  // The session backing this very browser tab — the "Déconnecter" action is
  // hidden for it in the UI (see ProfilePage) since the server itself
  // refuses to revoke it (use logout instead).
  isCurrent: boolean;
};

export const authApi = {
  // No tokens back — registration no longer logs the admin in, since email
  // verification is now blocking (see AuthService.register/login).
  register: (input: RegisterInput) => apiClient.post<{ email: string }>('/auth/register', input),
  login: (input: LoginInput) => apiClient.post<LoginResponse>('/auth/login', input),
  logout: () => apiClient.post<{ loggedOut: boolean }>('/auth/logout'),
  me: () => apiClient.get<AuthUser>('/auth/me'),
  updateProfile: (input: UpdateProfileInput) => apiClient.patch<AuthUser>('/auth/me', input),
  changePassword: (input: ChangePasswordInput) =>
    apiClient.patch<{ changed: boolean }>('/auth/me/password', input),
  listSessions: () => apiClient.get<Session[]>('/auth/sessions'),
  revokeSession: (id: string) => apiClient.delete<{ revoked: boolean }>(`/auth/sessions/${id}`),
  revokeOtherSessions: () => apiClient.post<{ revoked: boolean }>('/auth/sessions/revoke-others'),
  verifyEmail: (input: VerifyEmailInput) =>
    apiClient.post<{ verified: boolean }>('/auth/verify-email', input),
  // Public (no auth) — an unverified admin can't log in yet to request this.
  resendVerification: (input: ResendVerificationInput) =>
    apiClient.post<{ sent: boolean }>('/auth/resend-verification', input),
  forgotPassword: (input: ForgotPasswordInput) =>
    apiClient.post<{ sent: boolean }>('/auth/forgot-password', input),
  resetPassword: (input: ResetPasswordInput) =>
    apiClient.post<{ reset: boolean }>('/auth/reset-password', input),
};
