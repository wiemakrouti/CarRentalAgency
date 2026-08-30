import type { ClientListParams } from './clients.api';

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (params: ClientListParams) => [...clientKeys.lists(), params] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
  stats: (id: string) => [...clientKeys.all, 'stats', id] as const,
  deletable: (id: string) => [...clientKeys.all, 'deletable', id] as const,
  phoneDuplicate: (phone: string, excludeId?: string) =>
    [...clientKeys.all, 'phone-duplicate', phone, excludeId] as const,
};
