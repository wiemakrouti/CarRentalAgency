import { useState } from 'react';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { PAYMENT_METHODS, PAYMENT_STATUSES, PAYMENT_TYPES } from '@car-rental/shared';
import { Plus, Wallet } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { FilterBar } from '@/components/common/filter-bar';
import { Pagination } from '@/components/common/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { usePaymentsQuery } from '../hooks/use-payments';
import type { Payment } from '../api/finances.api';
import { PaymentRowActions } from './payment-row-actions';
import { PaymentFormDialog } from './payment-form-dialog';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_BADGE_VARIANT,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
} from '../lib/finance-labels';

const ALL_VALUE = '__all__';
const PAGE_SIZE = 20;

function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fr-TN') : '—';
}

const columnHelper = createColumnHelper<Payment>();

const columns = [
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
  columnHelper.accessor('status', {
    header: 'Statut',
    cell: ({ getValue }) => (
      <Badge variant={PAYMENT_STATUS_BADGE_VARIANT[getValue()]}>{PAYMENT_STATUS_LABELS[getValue()]}</Badge>
    ),
  }),
  columnHelper.accessor('paidAt', { header: 'Encaissé le', cell: ({ getValue }) => formatDate(getValue()) }),
  columnHelper.accessor('amount', {
    header: 'Montant',
    cell: ({ getValue }) => `${Number(getValue()).toLocaleString('fr-TN')} DT`,
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    cell: ({ row }) => <PaymentRowActions payment={row.original} />,
  }),
];

export function PaymentsTab() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [type, setType] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [method, setMethod] = useState<string | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = usePaymentsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    type,
    status,
    method,
  });

  function clearAllFilters() {
    setSearchInput('');
    setType(undefined);
    setStatus(undefined);
    setMethod(undefined);
    setPage(1);
  }

  const activeFilterCount = [type, status, method].filter(Boolean).length;

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
            <Select
              value={type ?? ALL_VALUE}
              onValueChange={(value) => {
                setType(value === ALL_VALUE ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tous les types</SelectItem>
                {PAYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {PAYMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status ?? ALL_VALUE}
              onValueChange={(value) => {
                setStatus(value === ALL_VALUE ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tous les statuts</SelectItem>
                {PAYMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {PAYMENT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={method ?? ALL_VALUE}
              onValueChange={(value) => {
                setMethod(value === ALL_VALUE ? undefined : value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Méthode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Toutes les méthodes</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

      <PaymentFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
