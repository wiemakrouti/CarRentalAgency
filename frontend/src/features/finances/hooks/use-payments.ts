import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreatePaymentInput, UpdatePaymentInput } from '@car-rental/shared';
import { carKeys } from '@/features/cars/api/cars.keys';
import { clientKeys } from '@/features/clients/api/clients.keys';
import { rentalKeys } from '@/features/rentals/api/rentals.keys';
import { financesApi, type PaymentListParams } from '../api/finances.api';
import { financeSummaryKeys, paymentKeys } from '../api/finances.keys';

// A payment always belongs to a rental (and a DEPOSIT_REFUND flips
// Rental.depositReturned) — invalidate broadly enough that the Rentals
// module and the summary widget never show stale money.
//
// carKeys/clientKeys are invalidated broadly (not scoped to the one car/
// client this payment's rental belongs to) because the Payment rows these
// mutations act on never carry carId/clientId directly, only rentalId
// (PaymentsRepository's own PAYMENT_INCLUDE has no nested rental) — CarsRepository.getStats
// and ClientsRepository.getStats both sum COMPLETED payments into
// "totalRevenue", so adding/correcting/archiving a payment from Finances
// (not just from the rental's own detail sheet) can change either stat
// without ever going through a rental-lifecycle mutation to invalidate them.
function invalidatePaymentEffects(queryClient: ReturnType<typeof useQueryClient>, rentalId?: string) {
  queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
  queryClient.invalidateQueries({ queryKey: financeSummaryKeys.all });
  if (rentalId) queryClient.invalidateQueries({ queryKey: rentalKeys.detail(rentalId) });
  queryClient.invalidateQueries({ queryKey: rentalKeys.lists() });
  queryClient.invalidateQueries({ queryKey: carKeys.all });
  queryClient.invalidateQueries({ queryKey: clientKeys.all });
}

export function usePaymentsQuery(params: PaymentListParams) {
  return useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: () => financesApi.listPayments(params),
  });
}

export function usePaymentQuery(id: string) {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: () => financesApi.getPaymentById(id),
    enabled: Boolean(id),
  });
}

export function useCreatePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => financesApi.createPayment(input),
    onSuccess: (payment) => invalidatePaymentEffects(queryClient, payment.rentalId),
  });
}

export function useUpdatePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePaymentInput }) => financesApi.updatePayment(id, input),
    onSuccess: (payment) => {
      queryClient.setQueryData(paymentKeys.detail(payment.id), payment);
      invalidatePaymentEffects(queryClient, payment.rentalId);
    },
  });
}

export function useArchivePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financesApi.archivePayment(id),
    onSuccess: (payment) => invalidatePaymentEffects(queryClient, payment.rentalId),
  });
}

export function useRestorePaymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => financesApi.restorePayment(id),
    onSuccess: (payment) => invalidatePaymentEffects(queryClient, payment.rentalId),
  });
}

function invalidatePaymentAttachments(
  queryClient: ReturnType<typeof useQueryClient>,
  paymentId: string,
  rentalId?: string,
) {
  queryClient.invalidateQueries({ queryKey: paymentKeys.detail(paymentId) });
  queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
  if (rentalId) queryClient.invalidateQueries({ queryKey: rentalKeys.detail(rentalId) });
}

export function useUploadPaymentAttachmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, file }: { paymentId: string; file: File; rentalId?: string }) =>
      financesApi.uploadPaymentAttachment(paymentId, file),
    onSuccess: (_attachment, variables) =>
      invalidatePaymentAttachments(queryClient, variables.paymentId, variables.rentalId),
  });
}

export function useDeletePaymentAttachmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, attachmentId }: { paymentId: string; attachmentId: string; rentalId?: string }) =>
      financesApi.deletePaymentAttachment(paymentId, attachmentId),
    onSuccess: (_result, variables) =>
      invalidatePaymentAttachments(queryClient, variables.paymentId, variables.rentalId),
  });
}
