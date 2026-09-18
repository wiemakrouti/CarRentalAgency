import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { ChevronRight, ShieldCheck } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useFormatMoney } from '@/hooks/use-format-money';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { FilterBar } from '@/components/common/filter-bar';
import { Pagination } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useDepositsQuery } from '../hooks/use-finance-summary';
import type { Deposit } from '../api/finances.api';
import { DepositFiltersPopover, type DepositFilters } from './deposit-filters-popover';

const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-TN') : '—';
}

const columnHelper = createColumnHelper<Deposit>();

function buildColumns(formatMoney: (amount: number) => string) {
  return [
    columnHelper.accessor('rentalNumber', {
      header: 'Location',
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue()}</span>,
    }),
    columnHelper.accessor((row) => `${row.client.firstName} ${row.client.lastName}`, {
      id: 'client',
      header: 'Client',
    }),
    columnHelper.accessor((row) => `${row.car.brand} ${row.car.model}`, {
      id: 'car',
      header: 'Voiture',
    }),
    columnHelper.display({
      id: 'status',
      header: 'Statut',
      cell: ({ row }) =>
        row.original.refundedAt ? (
          <Badge variant="success">Remboursée</Badge>
        ) : (
          <Badge variant="warning">En cours</Badge>
        ),
    }),
    columnHelper.accessor('collectedAt', { header: 'Encaissée le', cell: ({ getValue }) => formatDate(getValue()) }),
    columnHelper.accessor('refundedAt', {
      header: 'Remboursée le',
      cell: ({ getValue }) => {
        const value = getValue();
        return value ? formatDate(value) : <span className="text-muted-foreground">—</span>;
      },
    }),
    columnHelper.accessor('amount', { header: 'Montant', cell: ({ getValue }) => formatMoney(getValue()) }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Link
          to={`/rentals?openId=${row.original.rentalId}`}
          className="flex items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          title="Ouvrir la location"
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ),
    }),
  ];
}

export function DepositsTab() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  // Status + date range in one object, applied together from the
  // "Filtrer" popover. Defaults to "Toutes les dates" — same reasoning as
  // PaymentsTab/ExpensesTab's own filters: this is a ledger to browse, not
  // a bounded report.
  const [filters, setFilters] = useState<DepositFilters>({});

  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = useDepositsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    status: filters.status as 'OUTSTANDING' | 'REFUNDED' | undefined,
    from: filters.from,
    to: filters.to,
  });

  function applyFilters(next: DepositFilters) {
    setFilters(next);
    setPage(1);
  }

  function clearAllFilters() {
    setSearchInput('');
    setFilters({});
    setPage(1);
  }

  const activeFilterCount = [filters.status, filters.from || filters.to].filter(Boolean).length;

  const formatMoney = useFormatMoney();
  const columns = useMemo(() => buildColumns(formatMoney), [formatMoney]);

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={searchInput}
          onChange={(value) => {
            setSearchInput(value);
            setPage(1);
          }}
          placeholder="Rechercher par client, voiture, n° location..."
          className="w-80"
        />
        <FilterBar activeCount={activeFilterCount} onClearAll={clearAllFilters}>
          <DepositFiltersPopover value={filters} onApply={applyFilters} activeCount={activeFilterCount} />
        </FilterBar>
      </div>

      {isLoading && <LoadingState message="Chargement des cautions..." />}

      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          icon={ShieldCheck}
          title="Aucune caution trouvée"
          description="Essayez de modifier vos filtres."
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
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cell.column.id === 'amount' ? 'text-right tabular-nums' : undefined}
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
    </div>
  );
}
