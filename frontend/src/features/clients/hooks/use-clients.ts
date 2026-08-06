import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientDocumentType, CreateClientInput, UpdateClientInput } from '@car-rental/shared';
import { clientsApi, type ClientListParams } from '../api/clients.api';
import { clientKeys } from '../api/clients.keys';

export function useClientsQuery(params: ClientListParams) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () => clientsApi.list(params),
  });
}

export function useClientQuery(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: () => clientsApi.getById(id),
    enabled: Boolean(id),
  });
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) => clientsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
    },
  });
}

export function useUpdateClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateClientInput }) => clientsApi.update(id, input),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(client.id) });
    },
  });
}

export function useArchiveClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.archive(id),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(client.id) });
    },
  });
}

export function useRestoreClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.restore(id),
    onSuccess: (client) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(client.id) });
    },
  });
}

function invalidateClientDocuments(queryClient: ReturnType<typeof useQueryClient>, clientId: string) {
  queryClient.invalidateQueries({ queryKey: clientKeys.detail(clientId) });
  queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
}

export function useUploadClientDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      clientId,
      file,
      type,
      expiryDate,
    }: {
      clientId: string;
      file: File;
      type: ClientDocumentType;
      expiryDate?: string;
    }) => clientsApi.uploadDocument(clientId, file, type, expiryDate),
    onSuccess: (_document, variables) => invalidateClientDocuments(queryClient, variables.clientId),
  });
}

export function useDeleteClientDocumentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, documentId }: { clientId: string; documentId: string }) =>
      clientsApi.deleteDocument(clientId, documentId),
    onSuccess: (_result, variables) => invalidateClientDocuments(queryClient, variables.clientId),
  });
}
