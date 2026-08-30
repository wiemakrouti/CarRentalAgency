import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ClientSortField, SortOrder } from '../api/clients.api';

type SortableHeaderProps = {
  label: string;
  field: ClientSortField;
  sortBy: ClientSortField;
  sortOrder: SortOrder;
  onSort: (field: ClientSortField) => void;
};

// Server-side sort, not TanStack Table's built-in client sort — the table
// only ever holds one page of rows (mirrors cars/components/sortable-header.tsx).
export function SortableHeader({ label, field, sortBy, sortOrder, onSort }: SortableHeaderProps) {
  const isActive = sortBy === field;
  const Icon = isActive ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground data-[active=true]:text-primary"
      data-active={isActive}
      onClick={() => onSort(field)}
    >
      {label}
      <Icon className={`h-3.5 w-3.5 ${isActive ? 'opacity-100 text-primary' : 'opacity-40'}`} />
    </Button>
  );
}
