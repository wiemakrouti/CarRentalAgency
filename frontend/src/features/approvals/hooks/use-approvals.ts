import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { ApprovalStatus } from '@car-rental/shared';

import { useAuth } from '@/providers/auth-context';
import { useCan } from '@/hooks/use-can';
import { carKeys } from '@/features/cars/api/cars.keys';
import { rentalKeys } from '@/features/rentals/api/rentals.keys';
import { expenseKeys, financeSummaryKeys } from '@/features/finances/api/finances.keys';
import { activityKeys } from '@/features/activity/api/activity.keys';

import { approvalsApi } from '../api/approvals.api';
import { approvalKeys } from '../api/approvals.keys';

// Quick enough that an employee with a client at the counter gets the
// director's answer within half a minute.
export const APPROVALS_REFETCH_INTERVAL_MS = 30 * 1000;

// The director: every request of the agency; an employee: their own.
export function useApprovalsQuery(status?: ApprovalStatus) {
  const { user } = useAuth();
  return useQuery({
    queryKey: approvalKeys.list(status),
    queryFn: () => approvalsApi.list(status),
    enabled: Boolean(user),
    refetchInterval: APPROVALS_REFETCH_INTERVAL_MS,
  });
}

// Requests come and go from many places (the forms, the journal, the bell):
// after any of them, refresh the requests themselves, the journal, and
// whatever an approval may have just created or changed.
export function invalidateApprovalEffects(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: approvalKeys.all });
  queryClient.invalidateQueries({ queryKey: activityKeys.all });
  queryClient.invalidateQueries({ queryKey: rentalKeys.all });
  queryClient.invalidateQueries({ queryKey: carKeys.all });
  queryClient.invalidateQueries({ queryKey: expenseKeys.all });
  queryClient.invalidateQueries({ queryKey: financeSummaryKeys.all });
}

function useApprovalMutation(fn: (id: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => invalidateApprovalEffects(queryClient) });
}

export const useApproveMutation = () => useApprovalMutation(approvalsApi.approve);
export const useRejectMutation = () => useApprovalMutation(approvalsApi.reject);
export const useWithdrawMutation = () => useApprovalMutation(approvalsApi.withdraw);

// The director's requests waiting for a decision — what the activity
// journal lists first and the "Journal d'activité" link counts.
export function usePendingApprovalsQuery() {
  const canDecide = useCan('approval.decide');
  return useQuery({
    queryKey: approvalKeys.list('PENDING'),
    queryFn: () => approvalsApi.list('PENDING'),
    enabled: canDecide,
    refetchInterval: APPROVALS_REFETCH_INTERVAL_MS,
  });
}

export function useMarkDecisionsSeenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => approvalsApi.markSeen(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: approvalKeys.all }),
  });
}
