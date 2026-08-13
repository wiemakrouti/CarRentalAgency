import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type RangeFilters = {
  minDailyRate?: string;
  maxDailyRate?: string;
  minYear?: string;
  maxYear?: string;
  minMileage?: string;
  maxMileage?: string;
};

type CarRangeFiltersProps = {
  value: RangeFilters;
  onApply: (value: RangeFilters) => void;
  activeCount: number;
};

const RANGE_FIELDS: {
  min: keyof RangeFilters;
  max: keyof RangeFilters;
  label: string;
  unit: string;
}[] = [
  { min: 'minDailyRate', max: 'maxDailyRate', label: 'Tarif / jour', unit: 'DT' },
  { min: 'minYear', max: 'maxYear', label: 'Année', unit: '' },
  { min: 'minMileage', max: 'maxMileage', label: 'Kilométrage', unit: 'km' },
];

// Draft state lives locally so typing doesn't refetch on every keystroke —
// filters only apply (and hit the URL/API) when the admin clicks "Appliquer",
// same debounce intent as the search box but explicit rather than timed.
export function CarRangeFilters({ value, onApply, activeCount }: CarRangeFiltersProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RangeFilters>(value);

  function handleOpenChange(next: boolean) {
    if (next) setDraft(value);
    setOpen(next);
  }

  function handleApply() {
    onApply(draft);
    setOpen(false);
  }

  function handleReset() {
    const cleared: RangeFilters = {};
    setDraft(cleared);
    onApply(cleared);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Plus de filtres
          {activeCount > 0 && <span className="text-muted-foreground">({activeCount})</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4" align="start">
        {RANGE_FIELDS.map(({ min, max, label, unit }) => (
          <div key={min} className="space-y-2">
            <Label>
              {label} {unit && `(${unit})`}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Min"
                value={draft[min] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [min]: e.target.value }))}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                placeholder="Max"
                value={draft[max] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [max]: e.target.value }))}
              />
            </div>
          </div>
        ))}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Réinitialiser
          </Button>
          <Button size="sm" onClick={handleApply}>
            Appliquer
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
