import type { ActivityCategory, Role } from '@car-rental/shared';
import { apiClient } from '@/lib/api-client';
import { buildQueryString } from '@/lib/query-string';

export type ActivityActor = { id: string; fullName: string; role: Role };

// One audit-log entry, with the record as it was before and after.
export type ActivityEntry = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
  // Null for automatic actions (e.g. an expired reservation cancelled).
  actor: ActivityActor | null;
};

export type ActivityParams = {
  page?: number;
  pageSize?: number;
  userId?: string;
  category?: ActivityCategory;
  from?: string;
  to?: string;
};

export const activityApi = {
  list: (params: ActivityParams) => apiClient.getPaginated<ActivityEntry>(`/activity${buildQueryString(params)}`),
};
