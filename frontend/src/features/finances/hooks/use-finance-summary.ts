import { useQuery } from '@tanstack/react-query';
import { financesApi } from '../api/finances.api';
import { financeSummaryKeys } from '../api/finances.keys';

export function useFinanceSummaryQuery(from: string, to: string) {
  return useQuery({
    queryKey: financeSummaryKeys.range(from, to),
    queryFn: () => financesApi.getSummary(from, to),
    enabled: Boolean(from && to && to >= from),
  });
}
