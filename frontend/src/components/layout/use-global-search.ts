import { useQuery } from '@tanstack/react-query';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { carsApi } from '@/features/cars/api/cars.api';
import { carKeys } from '@/features/cars/api/cars.keys';
import { clientsApi } from '@/features/clients/api/clients.api';
import { clientKeys } from '@/features/clients/api/clients.keys';
import { rentalsApi } from '@/features/rentals/api/rentals.api';
import { rentalKeys } from '@/features/rentals/api/rentals.keys';

const RESULTS_PER_GROUP = 5;
// Below this, a search would match half the database on every keystroke.
const MIN_SEARCH_LENGTH = 2;

// Backs the Ctrl+K palette: the same server-side search each module's own
// list uses (clients by name/phone/licence, cars by brand/model/plate,
// rentals by number/car/client), a few results each. Only runs while the
// palette is open and something meaningful has been typed.
export function useGlobalSearch(search: string, enabled: boolean) {
  const term = useDebouncedValue(search.trim());
  const active = enabled && term.length >= MIN_SEARCH_LENGTH;
  const params = { page: 1, pageSize: RESULTS_PER_GROUP, search: term };

  const clients = useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () => clientsApi.list(params),
    enabled: active,
  });
  const cars = useQuery({
    queryKey: carKeys.list(params),
    queryFn: () => carsApi.list(params),
    enabled: active,
  });
  const rentals = useQuery({
    queryKey: rentalKeys.list(params),
    queryFn: () => rentalsApi.list(params),
    enabled: active,
  });

  return {
    active,
    // A searchable term typed but not debounced yet, or a request in flight.
    isSearching:
      enabled &&
      search.trim().length >= MIN_SEARCH_LENGTH &&
      (search.trim() !== term || clients.isFetching || cars.isFetching || rentals.isFetching),
    clients: active ? (clients.data?.items ?? []) : [],
    cars: active ? (cars.data?.items ?? []) : [],
    rentals: active ? (rentals.data?.items ?? []) : [],
  };
}
