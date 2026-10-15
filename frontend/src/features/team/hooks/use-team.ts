import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateEmployeeInput, ResetEmployeePasswordInput, UpdateEmployeeInput } from '@car-rental/shared';

import { teamApi } from '../api/team.api';
import { teamKeys } from '../api/team.keys';

export function useTeamQuery(options?: { enabled?: boolean }) {
  return useQuery({ queryKey: teamKeys.all, queryFn: () => teamApi.list(), enabled: options?.enabled });
}

// Every team change refreshes the list (status, name, temporary password).
function useTeamMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all }),
  });
}

export function useCreateEmployeeMutation() {
  return useTeamMutation((input: CreateEmployeeInput) => teamApi.create(input));
}

export function useUpdateEmployeeMutation() {
  return useTeamMutation(({ id, input }: { id: string; input: UpdateEmployeeInput }) => teamApi.update(id, input));
}

export function useSetEmployeeActiveMutation() {
  return useTeamMutation(({ id, active }: { id: string; active: boolean }) =>
    active ? teamApi.reactivate(id) : teamApi.deactivate(id),
  );
}

export function useResetEmployeePasswordMutation() {
  return useTeamMutation(({ id, input }: { id: string; input: ResetEmployeePasswordInput }) =>
    teamApi.resetPassword(id, input),
  );
}
