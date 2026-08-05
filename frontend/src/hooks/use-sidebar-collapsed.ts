import { useLocalStorageState } from '@/hooks/use-local-storage-state';

export function useSidebarCollapsed() {
  return useLocalStorageState('car-rental-sidebar-collapsed', false);
}
