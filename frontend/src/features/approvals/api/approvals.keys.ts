import type { ApprovalStatus } from '@car-rental/shared';

export const approvalKeys = {
  all: ['approvals'] as const,
  list: (status?: ApprovalStatus) => [...approvalKeys.all, 'list', status ?? 'all'] as const,
};
