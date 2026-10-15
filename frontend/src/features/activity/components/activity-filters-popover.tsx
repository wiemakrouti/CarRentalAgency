import { useState } from 'react';
import { Filter } from 'lucide-react';
import { ACTIVITY_CATEGORIES, type ActivityCategory } from '@car-rental/shared';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { TeamMember } from '@/features/team/api/team.api';

const ALL_VALUE = '__all__';

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  approvals: 'Demandes de validation',
  rentals: 'Locations',
  payments: 'Paiements',
  expenses: 'Dépenses',
  clients: 'Clients',
  cars: 'Voitures',
  team: 'Équipe',
  settings: 'Paramètres',
  account: 'Connexions et comptes',
};

export type ActivityFilters = {
  userId?: string;
  category?: ActivityCategory;
  from?: string;
  to?: string;
};

type ActivityFiltersPopoverProps = {
  value: ActivityFilters;
  onApply: (value: ActivityFilters) => void;
  activeCount: number;
  team: TeamMember[];
  // "Mon activité": no member choice, and no team/settings activity —
  // an employee never has any.
  ownOnly?: boolean;
};

// Member + kind of activity + period behind one "Filtrer" button. Draft
// state lives locally so nothing refetches until "Appliquer" is clicked.
// Same pattern as ExpenseFiltersPopover / PaymentFiltersPopover.
const OWN_ONLY_HIDDEN: ActivityCategory[] = ['team', 'settings'];

export function ActivityFiltersPopover({ value, onApply, activeCount, team, ownOnly = false }: ActivityFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ActivityFilters>(value);

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

  function set<K extends keyof ActivityFilters>(key: K, next: ActivityFilters[K]) {
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
      <PopoverContent
        className="flex max-h-[var(--radix-popover-content-available-height)] w-80 flex-col p-0"
        align="end"
        // Keeps a 16px gutter on a phone, where the button sits on the left.
        collisionPadding={16}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {!ownOnly && (
          <div className="space-y-2">
            <Label>Membre</Label>
            <Select value={draft.userId ?? ALL_VALUE} onValueChange={(v) => set('userId', v === ALL_VALUE ? undefined : v)}>
              <SelectTrigger aria-label="Membre">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tous les membres</SelectItem>
                {team.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.fullName}
                    {member.role === 'ADMIN' ? ' (directeur)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}

          <div className="space-y-2">
            <Label>Type d'activité</Label>
            <Select
              value={draft.category ?? ALL_VALUE}
              onValueChange={(v) => set('category', v === ALL_VALUE ? undefined : (v as ActivityCategory))}
            >
              <SelectTrigger aria-label="Type d'activité">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Toute l'activité</SelectItem>
                {ACTIVITY_CATEGORIES.filter((key) => !ownOnly || !OWN_ONLY_HIDDEN.includes(key)).map((key) => (
                  <SelectItem key={key} value={key}>
                    {CATEGORY_LABELS[key]}
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
