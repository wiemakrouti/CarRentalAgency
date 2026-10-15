import type {
  CreateEmployeeInput,
  ResetEmployeePasswordInput,
  Role,
  UpdateEmployeeInput,
} from '@car-rental/shared';
import { apiClient } from '@/lib/api-client';

export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  lastLoginAt: string | null;
  createdAt: string;
  deactivatedAt: string | null;
  // Still on the temporary password the director gave them.
  mustChangePassword: boolean;
};

export const teamApi = {
  list: () => apiClient.get<TeamMember[]>('/users'),
  create: (input: CreateEmployeeInput) => apiClient.post<TeamMember>('/users', input),
  update: (id: string, input: UpdateEmployeeInput) => apiClient.patch<TeamMember>(`/users/${id}`, input),
  deactivate: (id: string) => apiClient.post<TeamMember>(`/users/${id}/deactivate`),
  reactivate: (id: string) => apiClient.post<TeamMember>(`/users/${id}/reactivate`),
  resetPassword: (id: string, input: ResetEmployeePasswordInput) =>
    apiClient.post<TeamMember>(`/users/${id}/reset-password`, input),
};
