import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CarSortField, SortOrder } from '../api/cars.api';

type SortableHeaderProps = {
  label: string;
  field: CarSortField;
  sortBy: CarSortField;
  sortOrder: SortOrder;
  onSort: (field: CarSortField) => void;
};

// Server-side sort, not TanStack Table's built-in client sort — the table
// only ever holds one page of rows, so sorting client-side would just
// reorder the visible 20 instead of the whole filtered fleet.
export function SortableHeader({ label, field, sortBy, sortOrder, onSort }: SortableHeaderProps) {
  const isActive = sortBy === field;
  const Icon = isActive ? (sortOrder === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1.5 font-medium data-[active=true]:text-foreground"
      data-active={isActive}
      onClick={() => onSort(field)}
    >
      {label}
      <Icon className={`h-3.5 w-3.5 ${isActive ? 'opacity-100' : 'opacity-40'}`} />
    </Button>
  );
}
