import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientDocumentType, CreateClientInput, UpdateClientInput } from '@car-rental/shared';
import { notificationKeys } from '@/features/notifications/api/notifications.keys';
import { clientsApi, type ClientDuplicateFields, type ClientListParams } from '../api/clients.api';
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

// Powers the non-blocking duplicate warning in ClientFormDialog (phone, CIN,
// licence number) — no long cache lifetime since the whole point is to
// reflect what's in the database right now. Values shorter than 4
// characters are ignored: too short to identify anyone, and they'd match
// on every keystroke.
export function useCheckDuplicatesQuery(fields: ClientDuplicateFields, excludeId?: string) {
  const usable: ClientDuplicateFields = {};
  for (const [key, value] of Object.entries(fields) as [keyof ClientDuplicateFields, string | undefined][]) {
    const trimmed = value?.trim() ?? '';
    if (trimmed.length > 3) usable[key] = trimmed;
  }
  return useQuery({
    queryKey: clientKeys.duplicates(usable, excludeId),
    queryFn: () => clientsApi.checkDuplicates(usable, excludeId),
    enabled: Object.keys(usable).length > 0,
    staleTime: 0,
  });
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) => clientsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      // A newly added client can already carry an expired/expiring driving
      // license date.
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
      // Renewing a driving license date directly changes what the bell
      // shows — without this it only catches up on useRemindersQuery's
      // 5-minute interval, reading as "I just fixed this, why is the
      // notification still there".
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteClientMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.lists() });
      // Deleting a client drops any reminder tied to their driving license.
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
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
