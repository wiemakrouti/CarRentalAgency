import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCarInput, UpdateCarInput } from '@car-rental/shared';
import { carsApi, type CarListParams } from '../api/cars.api';
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

export function useCreateCarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCarInput) => carsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: carKeys.lists() });
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
    },
  });
}

export function useArchiveCarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => carsApi.archive(id),
    onSuccess: (car) => {
      queryClient.invalidateQueries({ queryKey: carKeys.lists() });
      queryClient.invalidateQueries({ queryKey: carKeys.detail(car.id) });
    },
  });
}

export function useRestoreCarMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => carsApi.restore(id),
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
    mutationFn: ({ carId, imageId }: { carId: string; imageId: string }) => carsApi.deleteImage(carId, imageId),
    onSuccess: (_result, variables) => invalidateCarImages(queryClient, variables.carId),
  });
}

export function useSetPrimaryImageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ carId, imageId }: { carId: string; imageId: string }) => carsApi.setPrimaryImage(carId, imageId),
    onSuccess: (_image, variables) => invalidateCarImages(queryClient, variables.carId),
  });
}
