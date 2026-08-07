import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRentalInput } from '@car-rental/shared';
import { carKeys } from '@/features/cars/api/cars.keys';
import { rentalsApi, type RentalListParams } from '../api/rentals.api';
import { rentalKeys } from '../api/rentals.keys';

export function useRentalsQuery(params: RentalListParams) {
  return useQuery({
    queryKey: rentalKeys.list(params),
    queryFn: () => rentalsApi.list(params),
  });
}

export function useRentalQuery(id: string) {
  return useQuery({
    queryKey: rentalKeys.detail(id),
    queryFn: () => rentalsApi.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateRentalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRentalInput) => rentalsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rentalKeys.lists() });
      // A new rental changes which cars are available for overlapping
      // dates — invalidate broadly rather than let a stale /cars/available
      // result linger in the create dialog's next open.
      queryClient.invalidateQueries({ queryKey: carKeys.all });
    },
  });
}
