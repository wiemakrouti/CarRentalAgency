import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCarInput, UpdateCarInput } from '@car-rental/shared';
import { notificationKeys } from '@/features/notifications/api/notifications.keys';
import { carsApi, type CarListParams, type ManualCarStatus } from '../api/cars.api';
import { carKeys } from '../api/cars.keys';

export function useCarsQuery(params: CarListParams) {
  return useQuery({
    queryKey: carKeys.list(params),
    queryFn: () => carsApi.list(params),
  });
}

export function useCarQuery(id: string) {
  return useQuery({
    queryKey: carKeys.detail(id),
    queryFn: () => carsApi.getById(id),
    enabled: Boolean(id),
  });
}

export function useCarStatsQuery(id: string | undefined) {
  return useQuery({
    queryKey: carKeys.stats(id ?? ''),
    queryFn: () => carsApi.getStats(id!),
    enabled: Boolean(id),
  });
}

// Powers the delete confirmation dialog: checked as soon as it opens so the
// dialog can show a destructive confirm or an explanatory notice up front,
// instead of only finding out after the admin submits.
export function useCarDeletableQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: carKeys.deletable(id),
    queryFn: () => carsApi.checkDeletable(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useAvailableCarsQuery(pickupDate: string, returnDate: string) {
  return useQuery({
    queryKey: carKeys.available(pickupDate, returnDate),
    queryFn: () => carsApi.available(pickupDate, returnDate),
    enabled: Boolean(pickupDate && returnDate && returnDate > pickupDate),
  });
}

export function useCreateCarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCarInput) => carsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: carKeys.lists() });
      // A newly added car can already carry an expired/expiring document
      // date (e.g. a used car bought with its insurance about to lapse).
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useUpdateCarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCarInput }) => carsApi.update(id, input),
    onSuccess: (car) => {
      queryClient.invalidateQueries({ queryKey: carKeys.lists() });
      queryClient.invalidateQueries({ queryKey: carKeys.detail(car.id) });
      // Renewing an insurance/inspection/registration date (or setting one
      // for the first time) directly changes what the bell shows — without
      // this it only catches up on useRemindersQuery's 5-minute interval,
      // reading as "I just fixed this, why is the notification still there".
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteCarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => carsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: carKeys.lists() });
      // Deleting a car drops any reminder tied to its documents.
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useUpdateCarStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ManualCarStatus }) =>
      carsApi.updateStatus(id, status),
    onSuccess: (car) => {
      queryClient.invalidateQueries({ queryKey: carKeys.lists() });
      queryClient.invalidateQueries({ queryKey: carKeys.detail(car.id) });
    },
  });
}

function invalidateCarImages(queryClient: ReturnType<typeof useQueryClient>, carId: string) {
  queryClient.invalidateQueries({ queryKey: carKeys.detail(carId) });
  queryClient.invalidateQueries({ queryKey: carKeys.lists() });
}

export function useUploadCarImageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ carId, file, isPrimary }: { carId: string; file: File; isPrimary: boolean }) =>
      carsApi.uploadImage(carId, file, isPrimary),
    onSuccess: (_image, variables) => invalidateCarImages(queryClient, variables.carId),
  });
}

export function useDeleteCarImageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ carId, imageId }: { carId: string; imageId: string }) =>
      carsApi.deleteImage(carId, imageId),
    onSuccess: (_result, variables) => invalidateCarImages(queryClient, variables.carId),
  });
}

export function useSetPrimaryImageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ carId, imageId }: { carId: string; imageId: string }) =>
      carsApi.setPrimaryImage(carId, imageId),
    onSuccess: (_image, variables) => invalidateCarImages(queryClient, variables.carId),
  });
}
