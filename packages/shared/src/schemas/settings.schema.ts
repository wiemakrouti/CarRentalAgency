import { z } from 'zod';

// Curated, not the full ISO 4217 list — this app displays money as
// "<amount> <symbol>" everywhere (see frontend's useFormatMoney), one fixed
// symbol per code, rather than full Intl.NumberFormat currency formatting
// (which would also vary decimal places and symbol position per currency).
// Covers the agency's home market (TND) plus the currencies a francophone
// car rental agency in the region is most likely to actually need.
export const CURRENCY_OPTIONS = [
  { code: 'TND', label: 'Dinar tunisien', symbol: 'DT' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'USD', label: 'Dollar américain', symbol: '$' },
  { code: 'MAD', label: 'Dirham marocain', symbol: 'DH' },
  { code: 'DZD', label: 'Dinar algérien', symbol: 'DA' },
  { code: 'GBP', label: 'Livre sterling', symbol: '£' },
] as const;

export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]['code'];
export const CURRENCY_CODES = CURRENCY_OPTIONS.map((option) => option.code) as [
  CurrencyCode,
  ...CurrencyCode[],
];

export const updateSettingsSchema = z.object({
  agencyName: z
    .string()
    .trim()
    .min(2, "Le nom de l'agence doit contenir au moins 2 caractères")
    .max(150),
  foundedAt: z.coerce.date().nullable().optional(),
  address: z.string().trim().min(1).nullable().optional(),
  // Normalized on blur by AgencyIdentity's phone field (see ProfilePage.tsx)
  // before it ever reaches this schema — the regex just guards against a
  // value that skipped that step (e.g. a future API client).
  phone: z
    .string()
    .trim()
    .regex(/^\+216 \d{2} \d{3} \d{3}$/, 'Format invalide (ex. +216 20 123 456)')
    .nullable()
    .optional(),
  email: z.string().trim().email('Adresse email invalide').nullable().optional(),
  logoUrl: z.string().trim().url('URL invalide').nullable().optional(),
  currencyCode: z.enum(CURRENCY_CODES),
  defaultDepositAmount: z.coerce.number().min(0, 'La caution par défaut ne peut pas être négative'),
  taxId: z.string().trim().min(1).nullable().optional(),
  iban: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, 'IBAN invalide')
    .nullable()
    .optional(),
  reminderWindowDays: z.coerce
    .number()
    .int('Doit être un nombre entier de jours')
    .min(1, 'Minimum 1 jour')
    .max(90, 'Maximum 90 jours'),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
