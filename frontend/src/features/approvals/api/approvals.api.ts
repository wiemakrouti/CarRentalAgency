import type { ApprovalStatus, ApprovalType } from '@car-rental/shared';

import { apiClient } from '@/lib/api-client';
import { buildQueryString } from '@/lib/query-string';

type Person = { id: string; fullName: string };

// A request an employee made for one of the three actions only the director
// can allow (see ApprovalsService on the backend). `summary` is what the
// director needs to decide, frozen at request time.
export type ApprovalRequest = {
  id: string;
  type: ApprovalType;
  status: ApprovalStatus;
  summary: Record<string, unknown>;
  entityId: string | null;
  requestedBy: Person;
  decidedBy: Person | null;
  decidedAt: string | null;
  requesterSeenAt: string | null;
  createdAt: string;
};

// What the rental/expense endpoints answer when an employee's submission
// became a request instead of the action itself (HTTP 202).
export type PendingApproval = { approvalRequest: ApprovalRequest };

export function isPendingApproval(value: unknown): value is PendingApproval {
  return (
    typeof value === 'object' &&
    value !== null &&
    'approvalRequest' in value &&
    (value as PendingApproval).approvalRequest !== null &&
    !('id' in value)
  );
}

export const approvalsApi = {
  list: (status?: ApprovalStatus) =>
    apiClient.get<ApprovalRequest[]>(`/approvals${buildQueryString({ status })}`),
  approve: (id: string) => apiClient.post<ApprovalRequest>(`/approvals/${id}/approve`),
  reject: (id: string) => apiClient.post<ApprovalRequest>(`/approvals/${id}/reject`),
  withdraw: (id: string) => apiClient.post<ApprovalRequest>(`/approvals/${id}/withdraw`),
  markSeen: () => apiClient.post<{ seen: boolean }>('/approvals/seen'),
};
