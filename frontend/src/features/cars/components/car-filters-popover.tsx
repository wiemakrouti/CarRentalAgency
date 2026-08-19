import { useState } from 'react';
import { Filter } from 'lucide-react';
import { CAR_CATEGORIES, CAR_STATUSES, TRANSMISSIONS } from '@car-rental/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { CAR_CATEGORY_LABELS, CAR_STATUS_LABELS, TRANSMISSION_LABELS } from '../lib/car-labels';

const ALL_VALUE = '__all__';

export type CarFilters = {
  category?: string;
  status?: string;
  transmission?: string;
  minDailyRate?: string;
  maxDailyRate?: string;
  minYear?: string;
  maxYear?: string;
  minMileage?: string;
  maxMileage?: string;
};

type CarFiltersPopoverProps = {
  value: CarFilters;
  onApply: (value: CarFilters) => void;
  activeCount: number;
};

const RANGE_FIELDS: {
  min: keyof CarFilters;
  max: keyof CarFilters;
  label: string;
  unit: string;
}[] = [
  { min: 'minDailyRate', max: 'maxDailyRate', label: 'Tarif / jour', unit: 'DT' },
  { min: 'minYear', max: 'maxYear', label: 'Année', unit: '' },
  { min: 'minMileage', max: 'maxMileage', label: 'Kilométrage', unit: 'km' },
];

// Draft state lives locally so nothing refetches until "Appliquer" is
// clicked — same intent as the search box's debounce, but explicit rather
// than timed, and consistent across every filter (category/status/
// transmission included) instead of only the numeric ranges.
export function CarFiltersPopover({ value, onApply, activeCount }: CarFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CarFilters>(value);

  function handleOpenChange(next: boolean) {
    if (next) setDraft(value);
    setOpen(next);
  }

  function handleApply() {
    onApply(draft);
    setOpen(false);
  }

  function handleReset() {
    setDraft({});
    onApply({});
    setOpen(false);
  }

  function set<K extends keyof CarFilters>(key: K, next: CarFilters[K]) {
    setDraft((d) => ({ ...d, [key]: next }));
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-1.5">
          <Filter className="h-4 w-4" />
          Filtrer
          {activeCount > 0 && <span className="text-muted-foreground">({activeCount})</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4" align="start">
        <div className="space-y-2">
          <Label>Catégorie</Label>
          <Select
            value={draft.category ?? ALL_VALUE}
            onValueChange={(v) => set('category', v === ALL_VALUE ? undefined : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Toutes les catégories</SelectItem>
              {CAR_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CAR_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Statut</Label>
          <Select
            value={draft.status ?? ALL_VALUE}
            onValueChange={(v) => set('status', v === ALL_VALUE ? undefined : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tous les statuts</SelectItem>
              {CAR_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CAR_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Transmission</Label>
          <Select
            value={draft.transmission ?? ALL_VALUE}
            onValueChange={(v) => set('transmission', v === ALL_VALUE ? undefined : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Transmission" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Toutes les transmissions</SelectItem>
              {TRANSMISSIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRANSMISSION_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

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
                onChange={(e) => set(min, e.target.value)}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                placeholder="Max"
                value={draft[max] ?? ''}
                onChange={(e) => set(max, e.target.value)}
              />
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-2">
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
