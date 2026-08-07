import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { RENTAL_STATUSES } from '@car-rental/shared';
import { ClipboardList, Plus } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
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

import { useRentalsQuery } from '../hooks/use-rentals';
import { RentalFormDialog } from '../components/rental-form-dialog';
import { RentalRowActions } from '../components/rental-row-actions';
import type { Rental } from '../api/rentals.api';
import { RENTAL_STATUS_BADGE_VARIANT, RENTAL_STATUS_LABELS } from '../lib/rental-labels';

const ALL_VALUE = '__all__';
const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

const columnHelper = createColumnHelper<Rental>();

const columns = [
  columnHelper.accessor('rentalNumber', { header: 'N° location' }),
  columnHelper.accessor((row) => `${row.car.brand} ${row.car.model} (${row.car.licensePlate})`, {
    id: 'car',
    header: 'Voiture',
  }),
  columnHelper.accessor((row) => `${row.client.firstName} ${row.client.lastName}`, {
    id: 'client',
    header: 'Client',
  }),
  columnHelper.accessor('pickupDate', {
    header: 'Départ',
    cell: ({ getValue }) => formatDate(getValue()),
  }),
  columnHelper.accessor('plannedReturnDate', {
    header: 'Retour prévu',
    cell: ({ getValue }) => formatDate(getValue()),
  }),
  columnHelper.accessor('status', {
    header: 'Statut',
    cell: ({ getValue }) => (
      <Badge variant={RENTAL_STATUS_BADGE_VARIANT[getValue()]}>{RENTAL_STATUS_LABELS[getValue()]}</Badge>
    ),
  }),
  columnHelper.accessor('totalAmount', {
    header: 'Total',
    cell: ({ getValue }) => `${Number(getValue()).toLocaleString('fr-TN')} DT`,
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    cell: ({ row }) => <RentalRowActions rental={row.original} />,
  }),
];

export function RentalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);

  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? undefined;

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = useRentalsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status,
  });

  function updateParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  }

  useEffect(() => {
    if (debouncedSearch !== search) {
      updateParam('search', debouncedSearch || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, search]);

  function clearAllFilters() {
    setSearchInput('');
    setSearchParams({});
  }

  const activeFilterCount = status ? 1 : 0;

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Gestion des locations"
        description="Créez et suivez les contrats de location en cours et passés."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle location
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Rechercher par n° location, voiture ou client..."
          className="w-80"
        />
        <FilterBar activeCount={activeFilterCount} onClearAll={clearAllFilters}>
          <Select
            value={status ?? ALL_VALUE}
            onValueChange={(value) => updateParam('status', value === ALL_VALUE ? undefined : value)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tous les statuts</SelectItem>
              {RENTAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {RENTAL_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
      </div>

      {isLoading && <LoadingState message="Chargement des locations..." />}

      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="Aucune location trouvée"
          description="Essayez de modifier vos filtres ou créez une nouvelle location."
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
            onPageChange={(nextPage) => updateParam('page', String(nextPage))}
          />
        </>
      )}

      <RentalFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </PageContainer>
  );
}

export default RentalsPage;
