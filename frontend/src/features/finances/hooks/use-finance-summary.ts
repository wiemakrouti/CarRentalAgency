import { useQuery } from '@tanstack/react-query';
import { financesApi, type DepositListParams } from '../api/finances.api';
import { depositsKeys, financeSummaryKeys } from '../api/finances.keys';

export function useFinanceSummaryQuery(from: string, to: string) {
  return useQuery({
    queryKey: financeSummaryKeys.range(from, to),
    queryFn: () => financesApi.getSummary(from, to),
    enabled: Boolean(from && to && to >= from),
  });
}

// Not period-bound like the summary above — "Cautions" is a standing ledger
// (every rental that ever had a collected caution, refunded or not), so its
// own from/to filters are opt-in (the Cautions tab's own DateRangeFilter),
// never the Résumé tab's.
export function useDepositsQuery(params: DepositListParams) {
  return useQuery({
    queryKey: depositsKeys.list(params),
    queryFn: () => financesApi.listDeposits(params),
  });
}
