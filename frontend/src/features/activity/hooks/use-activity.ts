import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { activityApi, type ActivityParams } from '../api/activity.api';
import { activityKeys } from '../api/activity.keys';

export function useActivityQuery(params: ActivityParams) {
  return useQuery({
    queryKey: activityKeys.list(params),
    queryFn: () => activityApi.list(params),
    placeholderData: keepPreviousData,
  });
}
