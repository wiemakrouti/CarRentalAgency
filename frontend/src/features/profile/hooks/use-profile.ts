import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ChangePasswordInput, UpdateProfileInput } from '@car-rental/shared';
import { authApi } from '@/features/auth/api/auth.api';

// No query/cache here — the signed-in user is a singleton held in
// AuthProvider's own state (set at login/session-restore), not a
// TanStack Query cache other components read independently. A successful
// profile update just hands the fresh AuthUser back to the caller, which
// pushes it into AuthProvider via useAuth().updateUser.
export function useUpdateProfileMutation() {
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => authApi.updateProfile(input),
  });
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => authApi.changePassword(input),
  });
}

const sessionKeys = { all: ['auth', 'sessions'] as const };

export function useSessionsQuery() {
  return useQuery({
    queryKey: sessionKeys.all,
    queryFn: () => authApi.listSessions(),
  });
}

export function useRevokeSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}

export function useRevokeOtherSessionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.revokeOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
  });
}
