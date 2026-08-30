import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActivateRentalInput,
  CancelRentalInput,
  CreateRentalInput,
  ExtendRentalInput,
  ReturnRentalInput,
} from '@car-rental/shared';
import { carKeys } from '@/features/cars/api/cars.keys';
import { clientKeys } from '@/features/clients/api/clients.keys';
import { financeSummaryKeys, paymentKeys } from '@/features/finances/api/finances.keys';
import { rentalsApi, type RentalListParams } from '../api/rentals.api';
import { rentalKeys } from '../api/rentals.keys';

export function useRentalsQuery(params: RentalListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: rentalKeys.list(params),
    queryFn: () => rentalsApi.list(params),
    enabled: options?.enabled,
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

export function useActivateRentalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ActivateRentalInput }) =>
      rentalsApi.activate(id, input),
    onSuccess: (rental) => {
      queryClient.invalidateQueries({ queryKey: rentalKeys.lists() });
      queryClient.setQueryData(rentalKeys.detail(rental.id), rental);
      // Activation flips Car.status to RENTED — invalidate broadly so
      // the Cars list and any /cars/available lookups reflect it.
      queryClient.invalidateQueries({ queryKey: carKeys.all });
    },
  });
}

export function useCancelRentalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CancelRentalInput }) =>
      rentalsApi.cancel(id, input),
    onSuccess: (rental) => {
      queryClient.invalidateQueries({ queryKey: rentalKeys.lists() });
      queryClient.setQueryData(rentalKeys.detail(rental.id), rental);
      // A RESERVED rental never touched Car.status, so no car cache to invalidate.
    },
  });
}

export function useReturnRentalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReturnRentalInput }) =>
      rentalsApi.returnRental(id, input),
    onSuccess: (rental) => {
      queryClient.invalidateQueries({ queryKey: rentalKeys.lists() });
      queryClient.setQueryData(rentalKeys.detail(rental.id), rental);
      // Return flips Car.status (to AVAILABLE, or whatever carStatusAfterReturn
      // was chosen) and updates its mileage.
      queryClient.invalidateQueries({ queryKey: carKeys.all });
      // The backend silently creates a LATE_FEE and/or DAMAGE_FEE payment as
      // part of returning a rental (rentals.service.ts) — the Finances
      // ledger and summary widget need to pick those up, not just the
      // rental itself.
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: financeSummaryKeys.all });
      // Completing a rental changes the client's stats (completed count,
      // on-time rate, last rental date) shown on their profile sheet.
      queryClient.invalidateQueries({ queryKey: clientKeys.stats(rental.clientId) });
    },
  });
}

export function useExtendRentalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ExtendRentalInput }) =>
      rentalsApi.extend(id, input),
    onSuccess: (rental) => {
      queryClient.invalidateQueries({ queryKey: rentalKeys.lists() });
      queryClient.setQueryData(rentalKeys.detail(rental.id), rental);
      // Extending changes the car's booked date range — /cars/available
      // results for overlapping dates may no longer be valid.
      queryClient.invalidateQueries({ queryKey: carKeys.all });
      // The backend also increments Rental.totalAmount and silently creates
      // an EXTENSION_PAYMENT (rentals.service.ts) — the Finances ledger and
      // summary widget need to pick that up too, not just the rental itself.
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: financeSummaryKeys.all });
    },
  });
}
