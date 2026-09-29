export type DateRange = { from?: string; to?: string };

export type BoundedPreset = 'this_month' | 'last_month' | 'this_year';

// Local getters, not `toISOString()` — Date objects like
// `new Date(year, month, 1)` are local midnight, and `toISOString()`
// converts to UTC first: in any timezone ahead of UTC that silently shifts
// "the 1st" back onto the last day of the previous month.
export function toDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeDateRangePreset(preset: BoundedPreset): Required<DateRange> {
  const now = new Date();
  switch (preset) {
    case 'this_month':
      return { from: toDateParam(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDateParam(now) };
    case 'last_month':
      return {
        from: toDateParam(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        to: toDateParam(new Date(now.getFullYear(), now.getMonth(), 0)),
      };
    case 'this_year':
      return { from: toDateParam(new Date(now.getFullYear(), 0, 1)), to: toDateParam(now) };
  }
}
