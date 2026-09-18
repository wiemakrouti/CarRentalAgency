import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { Plus, Receipt } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useFormatMoney } from '@/hooks/use-format-money';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { FilterBar } from '@/components/common/filter-bar';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useExpensesQuery } from '../hooks/use-expenses';
import type { Expense } from '../api/finances.api';
import { ExpenseRowActions } from './expense-row-actions';
import { ExpenseFormDialog } from './expense-form-dialog';
import { ExpenseFiltersPopover, type ExpenseFilters } from './expense-filters-popover';
import { EXPENSE_CATEGORY_LABELS } from '../lib/finance-labels';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

const columnHelper = createColumnHelper<Expense>();

// Actions only needs room for the "..." button, and Montant is a short
// right-aligned number that doesn't need a full share either — Date,
// Catégorie and Voiture split what's left between them equally.
function columnWidthClass(id: string): string {
  if (id === 'actions') return 'w-[8%]';
  if (id === 'amount') return 'w-[17%]';
  return 'w-[25%]';
}

function buildColumns(onEdit: (expense: Expense) => void, formatMoney: (amount: number) => string) {
  return [
    columnHelper.accessor('date', { header: 'Date', cell: ({ getValue }) => formatDate(getValue()) }),
    columnHelper.accessor('category', {
      header: 'Catégorie',
      // "Personnalisé" (OTHER) has no meaningful label of its own — show the
      // name the admin typed for it (stored in `description`) instead.
      cell: ({ row }) =>
        row.original.category === 'OTHER'
          ? row.original.description || EXPENSE_CATEGORY_LABELS.OTHER
          : EXPENSE_CATEGORY_LABELS[row.original.category],
    }),
    columnHelper.accessor((row) => (row.car ? `${row.car.brand} ${row.car.model}` : '—'), {
      id: 'car',
      header: 'Voiture',
    }),
    columnHelper.accessor('amount', {
      header: 'Montant',
      cell: ({ getValue }) => formatMoney(Number(getValue())),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => <ExpenseRowActions expense={row.original} onEdit={onEdit} />,
    }),
  ];
}

export function ExpensesTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  // Category + date range in one object, applied together from the
  // "Filtrer" popover.
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>(undefined);

  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = useExpensesQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    category: filters.category,
    from: filters.from,
    to: filters.to,
  });

  function applyFilters(next: ExpenseFilters) {
    setFilters(next);
    setPage(1);
  }

  function clearAllFilters() {
    setSearchInput('');
    setFilters({});
    setPage(1);
  }

  const activeFilterCount = [filters.category, filters.from || filters.to].filter(
    Boolean,
  ).length;

  function openCreateForm() {
    setEditingExpense(undefined);
    setFormOpen(true);
  }

  function openEditForm(expense: Expense) {
    setEditingExpense(expense);
    setFormOpen(true);
  }

  const formatMoney = useFormatMoney();
  const columns = useMemo(() => buildColumns(openEditForm, formatMoney), [formatMoney]);

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
          <FilterBar activeCount={activeFilterCount} onClearAll={clearAllFilters}>
            <ExpenseFiltersPopover value={filters} onApply={applyFilters} activeCount={activeFilterCount} />
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
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-elevation">
            {/* table-fixed + explicit widths so no column stretches to fit
                its content — Date/Catégorie/Voiture/Montant share the row
                evenly, Actions stays just wide enough for the "..." button.
                min-w keeps those percentages off a real floor: without it,
                a narrow (tablet/mobile) container shrinks a `w-full` fixed
                table right along with itself, crushing every column's text
                into unreadable truncation instead of letting the parent's
                overflow-x-auto scroll — same fallback the Cars/Rentals
                tables get for free from their natural (non-fixed) layout. */}
            <Table className="table-fixed min-w-[640px]">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={`${columnWidthClass(header.column.id)} truncate${header.column.id === 'amount' ? ' text-right' : ''}`}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => {
                  // Only a car-linked expense has a "concerned module" to
                  // jump to — a general expense (no car) has nowhere to go,
                  // so its row stays inert rather than navigating nowhere.
                  const carId = row.original.carId;
                  return (
                    <TableRow
                      key={row.id}
                      className={carId ? 'cursor-pointer' : undefined}
                      onClick={carId ? () => navigate(`/cars?openId=${carId}`) : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={`${columnWidthClass(cell.column.id)} truncate${cell.column.id === 'amount' ? ' text-right tabular-nums' : ''}`}
                          onClick={cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
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
