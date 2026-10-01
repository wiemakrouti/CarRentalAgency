import { useState } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import type { Client } from '../api/clients.api';
import { useClientsQuery } from '../hooks/use-clients';

const RESULT_LIMIT = 20;

type ClientComboboxProps = {
  value: Client | null;
  onChange: (client: Client | null) => void;
  id?: string;
};

// Searchable client picker backed by the server-side /clients search, so it
// works however many clients the agency has — a plain <Select> over one
// page of results silently hid every client past the first 100. Hands back
// the whole Client (not just its id) so callers can read its details (e.g.
// the driving-licence expiry) without a second fetch.
export function ClientCombobox({ value, onChange, id }: ClientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim());
  const { data, isFetching } = useClientsQuery({
    pageSize: RESULT_LIMIT,
    search: debouncedSearch || undefined,
    sortBy: 'lastName',
    sortOrder: 'asc',
  });
  const clients = data?.items ?? [];
  const hasMore = (data?.meta.total ?? 0) > clients.length;

  return (
    // modal: the picker lives inside a Dialog, whose focus trap would
    // otherwise keep the search input (rendered in a portal) from taking
    // focus or scrolling.
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between px-3 font-normal"
        >
          {value ? (
            <span className="flex min-w-0 items-center gap-2 truncate">
              {value.firstName} {value.lastName}
              <span className="text-muted-foreground">— {value.phone}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Rechercher un client</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        {/* Filtering happens server-side (shouldFilter off) — cmdk's own
            filter would only ever search the 20 results already loaded. */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Nom, téléphone, n° de permis..." value={search} onValueChange={setSearch} />
          <CommandList>
            {isFetching && clients.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recherche...
              </div>
            ) : (
              <CommandEmpty>Aucun client trouvé.</CommandEmpty>
            )}
            {clients.length > 0 && (
              <CommandGroup>
                {clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.id}
                    onSelect={() => {
                      onChange(client);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value?.id === client.id ? 'opacity-100' : 'opacity-0')} />
                    {client.firstName} {client.lastName}
                    <span className="ml-1 text-muted-foreground">— {client.phone}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {hasMore && (
              <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                {RESULT_LIMIT} premiers résultats — affinez la recherche pour trouver un autre client.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
