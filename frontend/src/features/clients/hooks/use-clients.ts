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

export function useClientStatsQuery(id: string | undefined) {
  return useQuery({
    queryKey: clientKeys.stats(id ?? ''),
    queryFn: () => clientsApi.getStats(id!),
    enabled: Boolean(id),
  });
}

// Powers the delete confirmation dialog: checked as soon as it opens so the
// dialog can show a destructive confirm or an explanatory notice up front,
// instead of only finding out after the admin submits.
export function useClientDeletableQuery(id: string, enabled: boolean) {
  return useQuery({
    queryKey: clientKeys.deletable(id),
    queryFn: () => clientsApi.checkDeletable(id),
    enabled: Boolean(id) && enabled,
  });
}

// Powers the non-blocking duplicate-phone warning in ClientFormDialog — no
// long cache lifetime since the whole point is to reflect what's in the
// database right now, not a value worth keeping around after the field
// changes again.
export function useCheckPhoneDuplicateQuery(phone: string, excludeId?: string) {
  return useQuery({
    queryKey: clientKeys.phoneDuplicate(phone, excludeId),
    queryFn: () => clientsApi.checkPhoneDuplicate(phone, excludeId),
    enabled: phone.trim().length > 3,
    staleTime: 0,
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

export function useDeleteClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
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
    }: {
      clientId: string;
      file: File;
      type: ClientDocumentType;
    }) => clientsApi.uploadDocument(clientId, file, type),
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
