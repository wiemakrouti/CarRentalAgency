import type { ActivityParams } from './activity.api';

export const activityKeys = {
  all: ['activity'] as const,
  list: (params: ActivityParams) => [...activityKeys.all, 'list', params] as const,
};
