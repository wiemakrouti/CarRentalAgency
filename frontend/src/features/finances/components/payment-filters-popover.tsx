import { useState } from 'react';
import { Filter } from 'lucide-react';
import { PAYMENT_METHODS, PAYMENT_STATUSES, PAYMENT_TYPES } from '@car-rental/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_TYPE_LABELS } from '../lib/finance-labels';

const ALL_VALUE = '__all__';

export type PaymentFilters = {
  type?: string;
  status?: string;
  method?: string;
  from?: string;
  to?: string;
};

type PaymentFiltersPopoverProps = {
  value: PaymentFilters;
  onApply: (value: PaymentFilters) => void;
  activeCount: number;
};

// Every filter — type, status, method and the date range — behind one
// "Filtrer" button. Draft state lives locally so nothing refetches until
// "Appliquer" is clicked. Same pattern as CarFiltersPopover /
// ClientFiltersPopover.
export function PaymentFiltersPopover({ value, onApply, activeCount }: PaymentFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PaymentFilters>(value);

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

  function set<K extends keyof PaymentFilters>(key: K, next: PaymentFilters[K]) {
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
            <Label>Type</Label>
            <Select value={draft.type ?? ALL_VALUE} onValueChange={(v) => set('type', v === ALL_VALUE ? undefined : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tous les types</SelectItem>
                {PAYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PAYMENT_TYPE_LABELS[t]}
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
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Méthode</Label>
            <Select
              value={draft.method ?? ALL_VALUE}
              onValueChange={(v) => set('method', v === ALL_VALUE ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Méthode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Toutes les méthodes</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
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
