import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSearchParams } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { CAR_CATEGORIES, CAR_STATUSES, TRANSMISSIONS } from '@car-rental/shared';
import { CarFront, ImageOff, Plus } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useCarsQuery } from '../hooks/use-cars';
import type { Car } from '../api/cars.api';
import { CarRowActions } from '../components/car-row-actions';
import { CarFormDialog } from '../components/car-form-dialog';
import { CarImageManagerDialog } from '../components/car-image-manager-dialog';
import { CAR_CATEGORY_LABELS, CAR_STATUS_BADGE_VARIANT, CAR_STATUS_LABELS, TRANSMISSION_LABELS } from '../lib/car-labels';

const ALL_VALUE = '__all__';
const PAGE_SIZE = 20;

const columnHelper = createColumnHelper<Car>();

function buildColumns(onEdit: (car: Car) => void, onManageImages: (car: Car) => void) {
  return [
    columnHelper.display({
      id: 'thumbnail',
      header: '',
      cell: ({ row }) => {
        const primary = row.original.images.find((img) => img.isPrimary) ?? row.original.images[0];
        return primary ? (
          <img src={primary.url} alt="" className="h-10 w-14 rounded-md object-cover" />
        ) : (
          <div className="flex h-10 w-14 items-center justify-center rounded-md bg-muted">
            <ImageOff className="h-4 w-4 text-muted-foreground" />
          </div>
        );
      },
    }),
    columnHelper.accessor((row) => `${row.brand} ${row.model}`, {
      id: 'brandModel',
      header: 'Marque / Modèle',
    }),
    columnHelper.accessor('licensePlate', { header: 'Immatriculation' }),
    columnHelper.accessor('category', {
      header: 'Catégorie',
      cell: ({ getValue }) => CAR_CATEGORY_LABELS[getValue()],
    }),
    columnHelper.accessor('status', {
      header: 'Statut',
      cell: ({ getValue }) => (
        <Badge variant={CAR_STATUS_BADGE_VARIANT[getValue()]}>{CAR_STATUS_LABELS[getValue()]}</Badge>
      ),
    }),
    columnHelper.accessor('dailyRate', {
      header: 'Tarif / jour',
      cell: ({ getValue }) => `${Number(getValue()).toLocaleString('fr-TN')} DT`,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => <CarRowActions car={row.original} onEdit={onEdit} onManageImages={onManageImages} />,
    }),
  ];
}

export function CarsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | undefined>(undefined);
  const [imageManagerCarId, setImageManagerCarId] = useState<string | undefined>(undefined);

  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const transmission = searchParams.get('transmission') ?? undefined;

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = useCarsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    category,
    status,
    transmission,
  });

  function updateParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  }

  // Debounces the search box so typing doesn't fire a request per keystroke —
  // the URL param (and therefore the query) only updates once typing settles.
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

  const activeFilterCount = [category, status, transmission].filter(Boolean).length;

  function openCreateForm() {
    setEditingCar(undefined);
    setFormOpen(true);
  }

  function openEditForm(car: Car) {
    setEditingCar(car);
    setFormOpen(true);
  }

  function openImageManager(car: Car) {
    setImageManagerCarId(car.id);
  }

  const columns = useMemo(() => buildColumns(openEditForm, openImageManager), []);

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Gestion des voitures"
        description="Ajoutez, modifiez et suivez la disponibilité de votre flotte de véhicules."
        actions={
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4" />
            Ajouter une voiture
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchBar
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Rechercher par marque, modèle ou immatriculation..."
          className="w-80"
        />
        <FilterBar activeCount={activeFilterCount} onClearAll={clearAllFilters}>
          <Select
            value={category ?? ALL_VALUE}
            onValueChange={(value) => updateParam('category', value === ALL_VALUE ? undefined : value)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Toutes les catégories</SelectItem>
              {CAR_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CAR_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status ?? ALL_VALUE}
            onValueChange={(value) => updateParam('status', value === ALL_VALUE ? undefined : value)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tous les statuts</SelectItem>
              {CAR_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CAR_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={transmission ?? ALL_VALUE}
            onValueChange={(value) => updateParam('transmission', value === ALL_VALUE ? undefined : value)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Transmission" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Toutes les transmissions</SelectItem>
              {TRANSMISSIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRANSMISSION_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBar>
      </div>

      {isLoading && <LoadingState message="Chargement des voitures..." />}

      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          icon={CarFront}
          title="Aucune voiture trouvée"
          description="Essayez de modifier vos filtres ou ajoutez une nouvelle voiture."
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

      <CarFormDialog open={formOpen} onOpenChange={setFormOpen} car={editingCar} />
      <CarImageManagerDialog
        open={Boolean(imageManagerCarId)}
        onOpenChange={(next) => !next && setImageManagerCarId(undefined)}
        carId={imageManagerCarId}
      />
    </PageContainer>
  );
}

export default CarsPage;
