import { useState } from 'react';
import { Filter } from 'lucide-react';

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

import type { ClientLicenseStatus } from '../api/clients.api';
import { LICENSE_STATUS_LABELS } from '../lib/client-alerts';

const ALL_VALUE = '__all__';

export type ClientFilters = {
  city?: string;
  licenseStatus?: ClientLicenseStatus;
};

type ClientFiltersPopoverProps = {
  value: ClientFilters;
  onApply: (value: ClientFilters) => void;
  activeCount: number;
};

const LICENSE_STATUS_OPTIONS: ClientLicenseStatus[] = ['ok', 'expiring', 'expired', 'not_set'];

// Draft state lives locally so nothing refetches until "Appliquer" is
// clicked — same intent as CarFiltersPopover (features/cars/components).
export function ClientFiltersPopover({ value, onApply, activeCount }: ClientFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ClientFilters>(value);

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

  function set<K extends keyof ClientFilters>(key: K, next: ClientFilters[K]) {
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
          <Label htmlFor="city-filter">Ville</Label>
          <Input
            id="city-filter"
            placeholder="Ex : Tunis"
            value={draft.city ?? ''}
            onChange={(e) => set('city', e.target.value || undefined)}
          />
        </div>

        <div className="space-y-2">
          <Label>Permis de conduire</Label>
          <Select
            value={draft.licenseStatus ?? ALL_VALUE}
            onValueChange={(v) =>
              set('licenseStatus', v === ALL_VALUE ? undefined : (v as ClientLicenseStatus))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Statut du permis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tous</SelectItem>
              {LICENSE_STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {LICENSE_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

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
