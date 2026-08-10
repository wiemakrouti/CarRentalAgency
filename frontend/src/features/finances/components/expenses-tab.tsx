import { useMemo, useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { EXPENSE_CATEGORIES } from '@car-rental/shared';
import { Plus, Receipt } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { FilterBar } from '@/components/common/filter-bar';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useExpensesQuery } from '../hooks/use-expenses';
import type { Expense } from '../api/finances.api';
import { ExpenseRowActions } from './expense-row-actions';
import { ExpenseFormDialog } from './expense-form-dialog';
import { EXPENSE_CATEGORY_LABELS } from '../lib/finance-labels';

const ALL_VALUE = '__all__';
const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

const columnHelper = createColumnHelper<Expense>();

function buildColumns(onEdit: (expense: Expense) => void) {
  return [
    columnHelper.accessor('date', { header: 'Date', cell: ({ getValue }) => formatDate(getValue()) }),
    columnHelper.accessor('category', {
      header: 'Catégorie',
      cell: ({ getValue }) => EXPENSE_CATEGORY_LABELS[getValue()],
    }),
    columnHelper.accessor('description', { header: 'Description' }),
    columnHelper.accessor((row) => (row.car ? `${row.car.brand} ${row.car.model}` : '—'), {
      id: 'car',
      header: 'Voiture',
    }),
    columnHelper.accessor('amount', {
      header: 'Montant',
      cell: ({ getValue }) => `${Number(getValue()).toLocaleString('fr-TN')} DT`,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => <ExpenseRowActions expense={row.original} onEdit={onEdit} />,
    }),
  ];
}

export function ExpensesTab() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);

  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = useExpensesQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    category,
  });

  function clearAllFilters() {
    setSearchInput('');
    setCategory(undefined);
    setPage(1);
  }

  function openCreateForm() {
    setEditingExpense(undefined);
    setFormOpen(true);
  }

  function openEditForm(expense: Expense) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  const columns = useMemo(() => buildColumns(openEditForm), []);

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            value={searchInput}
            onChange={(value) => {
              setSearchInput(value);
              setPage(1);
            }}
            placeholder="Rechercher par description..."
            className="w-72"
          />
          <FilterBar activeCount={category ? 1 : 0} onClearAll={clearAllFilters}>
            <Select
              value={category ?? ALL_VALUE}
              onValueChange={(value) => {
                setCategory(value === ALL_VALUE ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44">
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
          </FilterBar>
        </div>
        <Button onClick={openCreateForm}>
          <Plus className="h-4 w-4" />
          Nouvelle dépense
        </Button>
      </div>

      {isLoading && <LoadingState message="Chargement des dépenses..." />}

      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          icon={Receipt}
          title="Aucune dépense trouvée"
          description="Essayez de modifier vos filtres ou ajoutez une nouvelle dépense."
        />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Pagination
            page={data.meta.page}
            pageCount={Math.ceil(data.meta.total / data.meta.pageSize)}
            onPageChange={setPage}
          />
        </>
      )}

      <ExpenseFormDialog open={formOpen} onOpenChange={setFormOpen} expense={editingExpense} />
    </div>
  );
}
