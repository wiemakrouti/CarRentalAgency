import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type DateRange = { from?: string; to?: string };

type BoundedPreset = 'this_month' | 'last_month' | 'this_year';
type Preset = 'all' | BoundedPreset | 'custom';

const BOUNDED_PRESET_LABELS: Record<BoundedPreset, string> = {
  this_month: 'Ce mois-ci',
  last_month: 'Mois dernier',
  this_year: 'Cette année',
};

// Local getters, not `toISOString()` — the Date objects built below (e.g.
// `new Date(year, month, 1)`) are local midnight, and `toISOString()`
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

// Re-derived from `value` on every render instead of tracked as its own
// state — editing either date field by hand falls back to "Personnalisé"
// automatically, with no risk of the Select drifting out of sync with the
// actual range.
function detectPreset(value: DateRange, allowAllTime: boolean): Preset {
  if (!value.from && !value.to) return allowAllTime ? 'all' : 'custom';
  if (!value.from || !value.to) return 'custom';
  const match = (Object.keys(BOUNDED_PRESET_LABELS) as BoundedPreset[]).find((preset) => {
    const computed = computeDateRangePreset(preset);
    return computed.from === value.from && computed.to === value.to;
  });
  return match ?? 'custom';
}

type DateRangeFilterProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  // Whether an unbounded "Toutes les dates" option is offered — a ledger
  // (Paiements/Dépenses) can browse everything by default, but a summary
  // computed over a range always needs both ends set.
  allowAllTime?: boolean;
  className?: string;
};

export function DateRangeFilter({ value, onChange, allowAllTime = false, className }: DateRangeFilterProps) {
  const preset = detectPreset(value, allowAllTime);
  const presetOptions: Preset[] = [
    ...(allowAllTime ? (['all'] as const) : []),
    'this_month',
    'last_month',
    'this_year',
    'custom',
  ];

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Select
        value={preset}
        onValueChange={(next) => {
          if (next === 'all') onChange({ from: undefined, to: undefined });
          else if (next !== 'custom') onChange(computeDateRangePreset(next as BoundedPreset));
        }}
      >
        <SelectTrigger className="w-40" aria-label="Période">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presetOptions.map((p) => (
            <SelectItem key={p} value={p} disabled={p === 'custom'}>
              {p === 'all' ? 'Toutes les dates' : p === 'custom' ? 'Personnalisé' : BOUNDED_PRESET_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        aria-label="Du"
        className="w-[150px]"
        value={value.from ?? ''}
        max={value.to}
        onChange={(e) => onChange({ from: e.target.value || undefined, to: value.to })}
      />
      <span className="text-sm text-muted-foreground">→</span>
      <Input
        type="date"
        aria-label="Au"
        className="w-[150px]"
        value={value.to ?? ''}
        min={value.from}
        onChange={(e) => onChange({ from: value.from, to: e.target.value || undefined })}
      />
    </div>
  );
}
