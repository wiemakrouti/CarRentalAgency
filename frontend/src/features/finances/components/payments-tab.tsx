import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { Plus, Wallet } from 'lucide-react';

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

import { usePaymentsQuery } from '../hooks/use-payments';
import type { Payment } from '../api/finances.api';
import { PaymentRowActions } from './payment-row-actions';
import { PaymentFormDialog } from './payment-form-dialog';
import { PaymentFiltersPopover, type PaymentFilters } from './payment-filters-popover';
import { PAYMENT_METHOD_LABELS, PAYMENT_TYPE_LABELS } from '../lib/finance-labels';

const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-TN') : '—';
}

const columnHelper = createColumnHelper<Payment>();

function buildColumns(formatMoney: (amount: number) => string) {
  return [
    columnHelper.accessor((row) => row.rental?.rentalNumber ?? '—', { id: 'rentalNumber', header: 'N° location' }),
    columnHelper.accessor(
      (row) => (row.rental ? `${row.rental.client.firstName} ${row.rental.client.lastName}` : '—'),
      { id: 'client', header: 'Client' },
    ),
    columnHelper.accessor('type', { header: 'Type', cell: ({ getValue }) => PAYMENT_TYPE_LABELS[getValue()] }),
    columnHelper.accessor('method', {
      header: 'Méthode',
      cell: ({ getValue }) => PAYMENT_METHOD_LABELS[getValue()],
    }),
    columnHelper.accessor('paidAt', { header: 'Encaissé le', cell: ({ getValue }) => formatDate(getValue()) }),
    columnHelper.accessor('amount', {
      header: 'Montant',
      cell: ({ getValue }) => formatMoney(Number(getValue())),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => <PaymentRowActions payment={row.original} />,
    }),
  ];
}

export function PaymentsTab() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  // Every filter (type, status, method, date range) lives in one object,
  // applied together from the "Filtrer" popover.
  const [filters, setFilters] = useState<PaymentFilters>({});
  const [formOpen, setFormOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = usePaymentsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    type: filters.type,
    status: filters.status,
    method: filters.method,
    from: filters.from,
    to: filters.to,
  });

  function applyFilters(next: PaymentFilters) {
    setFilters(next);
    setPage(1);
  }

  function clearAllFilters() {
    setSearchInput('');
    setFilters({});
    setPage(1);
  }

  const activeFilterCount = [
    filters.type,
    filters.status,
    filters.method,
    filters.from || filters.to,
  ].filter(Boolean).length;

  const formatMoney = useFormatMoney();
  const columns = useMemo(() => buildColumns(formatMoney), [formatMoney]);

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
            placeholder="Rechercher par n° location ou client..."
            className="w-72"
          />
          <FilterBar activeCount={activeFilterCount} onClearAll={clearAllFilters}>
            <PaymentFiltersPopover value={filters} onApply={applyFilters} activeCount={activeFilterCount} />
          </FilterBar>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Nouveau paiement
        </Button>
      </div>

      {isLoading && <LoadingState message="Chargement des paiements..." />}

      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          icon={Wallet}
          title="Aucun paiement trouvé"
          description="Essayez de modifier vos filtres ou enregistrez un nouveau paiement."
        />
      )}

      {!isLoading && !isError && data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-elevation">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={header.column.id === 'amount' ? 'text-right' : undefined}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  // Every payment belongs to a rental — clicking the row
                  // jumps to that rental's own detail sheet (same
                  // deep-link pattern as the Cautions tab's row link).
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/rentals?openId=${row.original.rentalId}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cell.column.id === 'amount' ? 'text-right tabular-nums' : undefined}
                        onClick={cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
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

      <PaymentFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
