import { useCallback } from 'react';
import { CURRENCY_OPTIONS } from '@car-rental/shared';
import { useSettings } from '@/providers/settings-provider';

const SYMBOL_BY_CODE = new Map(CURRENCY_OPTIONS.map((option) => [option.code, option.symbol]));

// Falls back to the seed's own default (see prisma/seed.ts) — settings are
// still loading (or a request failed) for the brief window before the
// query resolves, and every call site expects a string back regardless.
const DEFAULT_SYMBOL = 'DT';

// Centralizes what used to be ~14 near-identical local helpers
// (`${amount.toLocaleString('fr-TN')} DT`) — the amount format itself
// (French grouping, symbol suffix) is unchanged, only the symbol now
// follows the agency's own currencyCode setting instead of a hardcoded "DT".
export function useFormatMoney() {
  const { settings } = useSettings();
  const symbol = settings ? (SYMBOL_BY_CODE.get(settings.currencyCode) ?? settings.currencyCode) : DEFAULT_SYMBOL;

  return useCallback((amount: number) => `${amount.toLocaleString('fr-TN')} ${symbol}`, [symbol]);
}
