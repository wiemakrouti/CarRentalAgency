import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CarFront, ClipboardList, FilePlus2, HandCoins, Loader2, Receipt, UserPlus, UserRound } from 'lucide-react';

import { navItems } from '@/lib/navigation';
import { useQuickActions, type QuickAction } from '@/providers/quick-actions-context';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';

import { useGlobalSearch } from './use-global-search';

const QUICK_ACTIONS: { action: QuickAction; label: string; icon: LucideIcon }[] = [
  { action: 'rental', label: 'Nouvelle location', icon: FilePlus2 },
  { action: 'client', label: 'Nouveau client', icon: UserPlus },
  { action: 'car', label: 'Nouvelle voiture', icon: CarFront },
  { action: 'payment', label: 'Encaisser un paiement', icon: HandCoins },
  { action: 'expense', label: 'Nouvelle dépense', icon: Receipt },
];

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function matches(label: string, search: string): boolean {
  return label.toLowerCase().includes(search.trim().toLowerCase());
}

// Ctrl+K from any page: jump to a module, start a common action, or find a
// client, car or rental by what you remember about it. Results come from the
// server (cmdk's own filtering is off); pages and actions are filtered here.
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { openQuickAction, openRental } = useQuickActions();
  const [search, setSearch] = useState('');
  const results = useGlobalSearch(search, open);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  // Each opening starts from a blank search.
  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const run = (effect: () => void) => {
    onOpenChange(false);
    effect();
  };

  const pages = navItems.filter((item) => matches(item.label, search));
  const actions = QUICK_ACTIONS.filter((item) => matches(item.label, search));
  const hasRecords = results.clients.length + results.cars.length + results.rentals.length > 0;
  const nothingFound = !results.isSearching && !hasRecords && pages.length === 0 && actions.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">Recherche globale</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Client, voiture, n° de location, page..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {results.isSearching && (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recherche...
              </div>
            )}
            {nothingFound && <p className="py-6 text-center text-sm text-muted-foreground">Aucun résultat.</p>}

            {results.clients.length > 0 && (
              <CommandGroup heading="Clients">
                {results.clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`client-${client.id}`}
                    onSelect={() => run(() => navigate(`/clients?openId=${client.id}`))}
                  >
                    <UserRound className="h-4 w-4" />
                    {client.firstName} {client.lastName}
                    <span className="ml-auto text-xs text-muted-foreground">{client.phone}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.cars.length > 0 && (
              <CommandGroup heading="Voitures">
                {results.cars.map((car) => (
                  <CommandItem
                    key={car.id}
                    value={`car-${car.id}`}
                    onSelect={() => run(() => navigate(`/cars?openId=${car.id}`))}
                  >
                    <CarFront className="h-4 w-4" />
                    {car.brand} {car.model}
                    <span className="ml-auto font-mono text-xs text-muted-foreground">{car.licensePlate}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {results.rentals.length > 0 && (
              <CommandGroup heading="Locations">
                {results.rentals.map((rental) => (
                  <CommandItem
                    key={rental.id}
                    value={`rental-${rental.id}`}
                    onSelect={() => run(() => openRental(rental.id))}
                  >
                    <ClipboardList className="h-4 w-4" />
                    <span className="font-mono text-xs">{rental.rentalNumber}</span>
                    <span className="truncate text-muted-foreground">
                      {rental.client.firstName} {rental.client.lastName} · {rental.car.brand} {rental.car.model}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {hasRecords && (actions.length > 0 || pages.length > 0) && <CommandSeparator />}

            {actions.length > 0 && (
              <CommandGroup heading="Actions rapides">
                {actions.map(({ action, label, icon: Icon }) => (
                  <CommandItem key={action} value={`action-${action}`} onSelect={() => run(() => openQuickAction(action))}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {pages.length > 0 && (
              <CommandGroup heading="Pages">
                {pages.map((item) => (
                  <CommandItem key={item.path} value={`page-${item.path}`} onSelect={() => run(() => navigate(item.path))}>
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
