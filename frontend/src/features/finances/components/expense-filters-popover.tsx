import { useState } from 'react';
import { Filter } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@car-rental/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { EXPENSE_CATEGORY_LABELS } from '../lib/finance-labels';

const ALL_VALUE = '__all__';

export type ExpenseFilters = {
  category?: string;
  from?: string;
  to?: string;
};

type ExpenseFiltersPopoverProps = {
  value: ExpenseFilters;
  onApply: (value: ExpenseFilters) => void;
  activeCount: number;
};

// Category + date range behind one "Filtrer" button. Draft state lives
// locally so nothing refetches until "Appliquer" is clicked. Same pattern
// as PaymentFiltersPopover / CarFiltersPopover / ClientFiltersPopover.
export function ExpenseFiltersPopover({ value, onApply, activeCount }: ExpenseFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ExpenseFilters>(value);

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

  function set<K extends keyof ExpenseFilters>(key: K, next: ExpenseFilters[K]) {
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
      {/* Caps at the space Radix actually has (var set whichever side it
          opens on) and scrolls internally; the action row stays pinned. */}
      <PopoverContent
        className="flex max-h-[var(--radix-popover-content-available-height)] w-80 flex-col p-0"
        align="start"
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
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
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {EXPENSE_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Période</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                aria-label="Du"
                value={draft.from ?? ''}
                max={draft.to}
                onChange={(e) => set('from', e.target.value || undefined)}
              />
              <Input
                type="date"
                aria-label="Au"
                value={draft.to ?? ''}
                min={draft.from}
                onChange={(e) => set('to', e.target.value || undefined)}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-3">
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
