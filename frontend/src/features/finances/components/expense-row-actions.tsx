import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Expense } from '../api/finances.api';

type ExpenseRowActionsProps = {
  expense: Expense;
  onEdit: (expense: Expense) => void;
};

export function ExpenseRowActions({ expense, onEdit }: ExpenseRowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(expense)}>Modifier</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
