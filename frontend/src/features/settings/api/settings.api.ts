import type { CurrencyCode, UpdateSettingsInput } from '@car-rental/shared';
import { apiClient } from '@/lib/api-client';

// Decimal fields (defaultDepositAmount) come back as strings — Prisma's
// Decimal serializes to JSON as a string, same convention as Car.dailyRate
// (see cars.api.ts) — convert with Number(...) at the point of use.
export type Settings = {
  id: string;
  agencyName: string;
  foundedAt: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  currencyCode: CurrencyCode;
  defaultDepositAmount: string;
  taxId: string | null;
  iban: string | null;
  reminderWindowDays: number;
  updatedAt: string;
};

export const settingsApi = {
  get: () => apiClient.get<Settings>('/settings'),
  update: (input: UpdateSettingsInput) => apiClient.patch<Settings>('/settings', input),
  uploadLogo: (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);
    return apiClient.postForm<Settings>('/settings/logo', formData);
  },
};
