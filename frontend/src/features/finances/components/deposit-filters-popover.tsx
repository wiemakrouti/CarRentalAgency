import { useState } from 'react';
import { Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangeFilter, type DateRange } from '@/components/common/date-range-filter';

const ALL_VALUE = '__all__';

export type DepositFilters = {
  status?: string;
  from?: string;
  to?: string;
};

type DepositFiltersPopoverProps = {
  value: DepositFilters;
  onApply: (value: DepositFilters) => void;
  activeCount: number;
};

// Statut + date range behind one "Filtrer" button. Draft state lives
// locally so nothing refetches until "Appliquer" is clicked. Same pattern
// as PaymentFiltersPopover / ExpenseFiltersPopover.
export function DepositFiltersPopover({ value, onApply, activeCount }: DepositFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DepositFilters>(value);

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

  function setDateRange(range: DateRange) {
    setDraft((d) => ({ ...d, from: range.from, to: range.to }));
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
            <Label>Statut</Label>
            <Select
              value={draft.status ?? ALL_VALUE}
              onValueChange={(v) => setDraft((d) => ({ ...d, status: v === ALL_VALUE ? undefined : v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Toutes</SelectItem>
                <SelectItem value="OUTSTANDING">En cours</SelectItem>
                <SelectItem value="REFUNDED">Remboursées</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Période</Label>
            <DateRangeFilter value={{ from: draft.from, to: draft.to }} onChange={setDateRange} allowAllTime />
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
