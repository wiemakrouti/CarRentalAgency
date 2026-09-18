import { useMutation } from '@tanstack/react-query';
import type { UpdateSettingsInput } from '@car-rental/shared';
import { settingsApi } from '../api/settings.api';

// No query here — SettingsProvider already owns the one settings query the
// whole app shares (see providers/settings-provider.tsx); this page only
// ever needs to write to it.
export function useUpdateSettingsMutation() {
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) => settingsApi.update(input),
  });
}

export function useUploadLogoMutation() {
  return useMutation({
    mutationFn: (file: File) => settingsApi.uploadLogo(file),
  });
}
