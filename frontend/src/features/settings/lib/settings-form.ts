import type { UpdateSettingsInput } from '@car-rental/shared';
import type { Settings } from '../api/settings.api';

// The API's PATCH /settings expects the complete settings object, not a
// partial one — shared by every page that edits a subset of it (Paramètres,
// the agency identity card on Profil), each merging its own edited fields
// over this before submitting so the fields it doesn't render stay
// untouched instead of being dropped or reset.
export function toSettingsFormValues(settings: Settings): UpdateSettingsInput {
  return {
    agencyName: settings.agencyName,
    foundedAt: settings.foundedAt ? new Date(settings.foundedAt) : null,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    logoUrl: settings.logoUrl,
    currencyCode: settings.currencyCode,
    defaultDepositAmount: Number(settings.defaultDepositAmount),
    taxId: settings.taxId,
    iban: settings.iban,
    reminderWindowDays: settings.reminderWindowDays,
  };
}
