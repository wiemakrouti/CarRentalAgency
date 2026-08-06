import { QueryClient } from '@tanstack/react-query';

// Shared across every feature module (Cars, Clients, Rentals, ...) — see
// docs/architecture.md "Server state" for the conventions built on top of it
// (query key factories, feature api/hooks files, cache invalidation on
// mutation success).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
