import { createContext, useContext } from 'react';
import type { Settings } from '@/features/settings/api/settings.api';

// Context + hook live apart from SettingsProvider so that file exports only a
// component (keeps React Fast Refresh working on it).

type SettingsContextValue = {
  settings: Settings | undefined;
  isLoading: boolean;
  // Lets a successful save in SettingsPage push the fresh row straight into
  // the shared cache, the same way useAuth().updateUser does for the
  // profile — every consumer (sidebar branding, money formatting, the
  // notification bell's window) re-renders with the new values immediately
  // instead of waiting out staleTime.
  setSettings: (settings: Settings) => void;
  refetch: () => void;
};

export const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
}
