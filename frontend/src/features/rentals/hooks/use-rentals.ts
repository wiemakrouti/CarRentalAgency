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
import { depositsKeys, financeSummaryKeys, paymentKeys } from '@/features/finances/api/finances.keys';
import { notificationKeys } from '@/features/notifications/api/notifications.keys';
import { rentalsApi, type RentalListParams } from '../api/rentals.api';
import { rentalKeys } from '../api/rentals.keys';

// The KPI header's counts drift out of date purely by time passing (a
// rental crosses from "en cours" to "en retard" with no mutation
// involved) — same problem the notification bell already solves with its
// own REFETCH_INTERVAL_MS, so this polls on the same 5-minute cadence
// rather than only refreshing when a mutation happens to invalidate it.
const RENTAL_SUMMARY_REFETCH_INTERVAL_MS = 5 * 60 * 1000;

export function useRentalsQuery(params: RentalListParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: rentalKeys.list(params),
    queryFn: () => rentalsApi.list(params),
    enabled: options?.enabled,
  });
}

export function useRentalSummaryQuery() {
  return useQuery({
    queryKey: rentalKeys.summary(),
    queryFn: () => rentalsApi.getSummary(),
    refetchInterval: RENTAL_SUMMARY_REFETCH_INTERVAL_MS,
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
    onSuccess: (rental) => {
      queryClient.invalidateQueries({ queryKey: rentalKeys.lists() });
      // Every lifecycle transition (create/activate/return/extend/cancel)
      // can move a rental into or out of one of the KPI header's buckets.
      queryClient.invalidateQueries({ queryKey: rentalKeys.summary() });
      queryClient.setQueryData(rentalKeys.detail(rental.id), rental);
      // A new rental changes which cars are available for overlapping
      // dates — invalidate broadly rather than let a stale /cars/available
      // result linger in the create dialog's next open.
      queryClient.invalidateQueries({ queryKey: carKeys.all });
      // A new rental counts toward the client's totalRentals immediately
      // (ClientsRepository.getStats counts every status, not just
      // COMPLETED) — shown on their profile sheet.
      queryClient.invalidateQueries({ queryKey: clientKeys.stats(rental.clientId) });
      // The "Location immédiate" tab can optionally collect a payment right
      // at booking (RentalsService.create's initialPayment) — the Finances
      // ledger and summary widget need to pick that up too.
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: financeSummaryKeys.all });
      // ...and that initial payment could itself be the DEPOSIT — a rental
      // booked and paid in one step can show up in "Cautions" immediately.
      queryClient.invalidateQueries({ queryKey: depositsKeys.all });
      // The "Location immédiate" tab can also activate the rental right at
      // booking (RentalsService.create's activation) — same reminder
      // implications as a manual activate() (its RENTAL_PICKUP_OVERDUE
      // reminder never applies, a return-due-soon one might already).
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
      // Every lifecycle transition (create/activate/return/extend/cancel)
      // can move a rental into or out of one of the KPI header's buckets.
      queryClient.invalidateQueries({ queryKey: rentalKeys.summary() });
      queryClient.setQueryData(rentalKeys.detail(rental.id), rental);
      // Activation flips Car.status to RENTED — invalidate broadly so
      // the Cars list and any /cars/available lookups reflect it.
      queryClient.invalidateQueries({ queryKey: carKeys.all });
      // Activating clears any RENTAL_PICKUP_OVERDUE reminder for this
      // rental (it's no longer RESERVED) and can surface a new return-due-
      // soon/overdue one now that it's ACTIVE.
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
      // Every lifecycle transition (create/activate/return/extend/cancel)
      // can move a rental into or out of one of the KPI header's buckets.
      queryClient.invalidateQueries({ queryKey: rentalKeys.summary() });
      queryClient.setQueryData(rentalKeys.detail(rental.id), rental);
      // A RESERVED rental never touched Car.status, so there's no status
      // change to invalidate for — but it did block the car for these
      // dates via the overlap check, not via status, so /cars/available
      // (and the rest of the Cars cache) still needs a refresh: the car is
      // bookable again for this range the moment the cancellation commits.
      queryClient.invalidateQueries({ queryKey: carKeys.all });
      // Cancelling changes the client's cancelledRentals/reliabilityRate,
      // shown on their profile sheet — same reasoning as the completed-
      // rentals invalidation below in useReturnRentalMutation.
      queryClient.invalidateQueries({ queryKey: clientKeys.stats(rental.clientId) });
      // It can also carry a RENTAL_PICKUP_OVERDUE reminder (missed pickup),
      // which needs to disappear once cancelled.
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
      // Every lifecycle transition (create/activate/return/extend/cancel)
      // can move a rental into or out of one of the KPI header's buckets.
      queryClient.invalidateQueries({ queryKey: rentalKeys.summary() });
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
      // A returned rental is no longer ACTIVE — its return-due-soon/
      // overdue reminder (if any) needs to disappear from the bell.
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
      // Every lifecycle transition (create/activate/return/extend/cancel)
      // can move a rental into or out of one of the KPI header's buckets.
      queryClient.invalidateQueries({ queryKey: rentalKeys.summary() });
      queryClient.setQueryData(rentalKeys.detail(rental.id), rental);
      // Extending changes the car's booked date range — /cars/available
      // results for overlapping dates may no longer be valid.
      queryClient.invalidateQueries({ queryKey: carKeys.all });
      // The backend also increments Rental.totalAmount and silently creates
      // an EXTENSION_PAYMENT (rentals.service.ts) — the Finances ledger and
      // summary widget need to pick that up too, not just the rental itself.
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: financeSummaryKeys.all });
      // Extending pushes back plannedReturnDate — the reminder's date/label
      // (and whether it's overdue at all) needs to reflect the new one.
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}
