import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi, type Settings } from '@/features/settings/api/settings.api';
import { useAuth } from './auth-context';
import { SettingsContext } from './settings-context';

const SETTINGS_QUERY_KEY = ['settings'] as const;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: settings,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => settingsApi.get(),
    // Nothing to fetch as ADMIN until AuthProvider has actually confirmed a
    // session — firing this alongside /auth/me would just be a guaranteed
    // 401 racing the real request.
    enabled: status === 'authenticated',
    staleTime: 5 * 60 * 1000,
  });

  const setSettings = useCallback(
    (next: Settings) => {
      queryClient.setQueryData(SETTINGS_QUERY_KEY, next);
    },
    [queryClient],
  );

  const value = useMemo(
    () => ({ settings, isLoading, setSettings, refetch: () => void refetch() }),
    [settings, isLoading, setSettings, refetch],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
