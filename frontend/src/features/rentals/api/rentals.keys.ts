import type { RentalListParams } from './rentals.api';

export const rentalKeys = {
  all: ['rentals'] as const,
  lists: () => [...rentalKeys.all, 'list'] as const,
  list: (params: RentalListParams) => [...rentalKeys.lists(), params] as const,
  // Under lists() on purpose: every rental and payment mutation already
  // invalidates lists(), so the dashboard's « À encaisser » card refreshes
  // after a payment or a return without any extra wiring.
  toCollect: () => [...rentalKeys.lists(), 'to-collect'] as const,
  // Under lists() for the same reason as toCollect(): any rental mutation
  // redraws the planning. planningAll() lets car mutations refresh it too.
  planningAll: () => [...rentalKeys.lists(), 'planning'] as const,
  planning: (from: string, to: string) => [...rentalKeys.planningAll(), from, to] as const,
  details: () => [...rentalKeys.all, 'detail'] as const,
  detail: (id: string) => [...rentalKeys.details(), id] as const,
  summary: () => [...rentalKeys.all, 'summary'] as const,
};
