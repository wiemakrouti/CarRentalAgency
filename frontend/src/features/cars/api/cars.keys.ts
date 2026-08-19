import type { CarListParams } from './cars.api';

// The convention every future module's query keys copy — see
// docs/architecture.md "Server state (TanStack Query)".
export const carKeys = {
  all: ['cars'] as const,
  lists: () => [...carKeys.all, 'list'] as const,
  list: (params: CarListParams) => [...carKeys.lists(), params] as const,
  details: () => [...carKeys.all, 'detail'] as const,
  detail: (id: string) => [...carKeys.details(), id] as const,
  stats: (id: string) => [...carKeys.all, 'stats', id] as const,
  deletable: (id: string) => [...carKeys.all, 'deletable', id] as const,
  available: (pickupDate: string, returnDate: string) =>
    [...carKeys.all, 'available', pickupDate, returnDate] as const,
};
