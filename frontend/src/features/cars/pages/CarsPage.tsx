import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSearchParams } from 'react-router-dom';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
  type RowSelectionState,
} from '@tanstack/react-table';
import { CAR_CATEGORIES, CAR_STATUSES, TRANSMISSIONS } from '@car-rental/shared';
import { CarFront, Download, ImageOff, LayoutGrid, Plus, Table2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { saveBlobAsFile } from '@/lib/download-file';

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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useCarsQuery } from '../hooks/use-cars';
import { carsApi, type Car, type CarSortField, type SortOrder } from '../api/cars.api';
import { CarRowActions } from '../components/car-row-actions';
import { CarFormDialog } from '../components/car-form-dialog';
import { CarImageManagerDialog } from '../components/car-image-manager-dialog';
import { CarDetailSheet } from '../components/car-detail-sheet';
import { CarCalendarDialog } from '../components/car-calendar-dialog';
import { CarGrid } from '../components/car-grid';
import { CarBulkActionsBar } from '../components/car-bulk-actions-bar';
import { CarExpiryAlerts } from '../components/car-expiry-alerts';
import { CarRangeFilters, type RangeFilters } from '../components/car-range-filters';
import { SortableHeader } from '../components/sortable-header';
import {
  CAR_CATEGORY_LABELS,
  CAR_STATUS_BADGE_VARIANT,
  CAR_STATUS_LABELS,
  TRANSMISSION_LABELS,
} from '../lib/car-labels';

const ALL_VALUE = '__all__';
const PAGE_SIZE = 20;
const VIEW_MODE_STORAGE_KEY = 'cars-view-mode';

type ViewMode = 'table' | 'grid';

function readStoredViewMode(): ViewMode {
  return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === 'grid' ? 'grid' : 'table';
}

const columnHelper = createColumnHelper<Car>();

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

type SortState = { sortBy: CarSortField; sortOrder: SortOrder };

function buildColumns(
  onEdit: (car: Car) => void,
  onManageImages: (car: Car) => void,
  onViewDetails: (car: Car) => void,
  onOpenCalendar: (car: Car) => void,
  sort: SortState,
  onSort: (field: CarSortField) => void,
) {
  function sortableHeader(label: string, field: CarSortField) {
    return () => (
      <SortableHeader
        label={label}
        field={field}
        sortBy={sort.sortBy}
        sortOrder={sort.sortOrder}
        onSort={onSort}
      />
    );
  }

  return [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
          aria-label="Tout sélectionner"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          aria-label="Sélectionner"
        />
      ),
    }),
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
      header: sortableHeader('Marque / Modèle', 'brand'),
    }),
    columnHelper.accessor('licensePlate', {
      header: sortableHeader('Immatriculation', 'licensePlate'),
    }),
    columnHelper.accessor('category', {
      header: sortableHeader('Catégorie', 'category'),
      cell: ({ getValue }) => CAR_CATEGORY_LABELS[getValue()],
    }),
    columnHelper.accessor('status', {
      header: sortableHeader('Statut', 'status'),
      cell: ({ getValue, row }) => (
        <div className="space-y-0.5">
          <Badge variant={CAR_STATUS_BADGE_VARIANT[getValue()]}>
            {CAR_STATUS_LABELS[getValue()]}
          </Badge>
          {row.original.activeRental && (
            <p className="text-xs text-muted-foreground">
              Retour prévu le {formatDate(row.original.activeRental.plannedReturnDate)}
            </p>
          )}
        </div>
      ),
    }),
    columnHelper.accessor('dailyRate', {
      header: sortableHeader('Tarif / jour', 'dailyRate'),
      cell: ({ getValue }) => `${Number(getValue()).toLocaleString('fr-TN')} DT`,
    }),
    columnHelper.display({
      id: 'alerts',
      header: 'Documents',
      cell: ({ row }) => <CarExpiryAlerts car={row.original} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <CarRowActions
          car={row.original}
          onEdit={onEdit}
          onManageImages={onManageImages}
          onViewDetails={onViewDetails}
          onOpenCalendar={onOpenCalendar}
        />
      ),
    }),
  ];
}

export function CarsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | undefined>(undefined);
  const [imageManagerCarId, setImageManagerCarId] = useState<string | undefined>(undefined);
  const [detailCarId, setDetailCarId] = useState<string | undefined>(undefined);
  const [calendarCar, setCalendarCar] = useState<Car | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredViewMode);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const transmission = searchParams.get('transmission') ?? undefined;
  const sortBy = (searchParams.get('sortBy') as CarSortField | null) ?? 'createdAt';
  const sortOrder = (searchParams.get('sortOrder') as SortOrder | null) ?? 'desc';
  const rangeFilters: RangeFilters = {
    minDailyRate: searchParams.get('minDailyRate') ?? undefined,
    maxDailyRate: searchParams.get('maxDailyRate') ?? undefined,
    minYear: searchParams.get('minYear') ?? undefined,
    maxYear: searchParams.get('maxYear') ?? undefined,
    minMileage: searchParams.get('minMileage') ?? undefined,
    maxMileage: searchParams.get('maxMileage') ?? undefined,
  };

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = useCarsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    category,
    status,
    transmission,
    sortBy,
    sortOrder,
    minDailyRate: rangeFilters.minDailyRate ? Number(rangeFilters.minDailyRate) : undefined,
    maxDailyRate: rangeFilters.maxDailyRate ? Number(rangeFilters.maxDailyRate) : undefined,
    minYear: rangeFilters.minYear ? Number(rangeFilters.minYear) : undefined,
    maxYear: rangeFilters.maxYear ? Number(rangeFilters.maxYear) : undefined,
    minMileage: rangeFilters.minMileage ? Number(rangeFilters.minMileage) : undefined,
    maxMileage: rangeFilters.maxMileage ? Number(rangeFilters.maxMileage) : undefined,
  });

  function updateParam(key: string, value: string | undefined) {
    updateParams({ [key]: value });
  }

  function updateParams(values: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!('page' in values)) next.delete('page');
    setSearchParams(next);
  }

  function handleSort(field: CarSortField) {
    if (sortBy !== field) {
      updateParams({ sortBy: field, sortOrder: 'asc' });
    } else {
      updateParams({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    }
  }

  function applyRangeFilters(next: RangeFilters) {
    updateParams({
      minDailyRate: next.minDailyRate,
      maxDailyRate: next.maxDailyRate,
      minYear: next.minYear,
      maxYear: next.maxYear,
      minMileage: next.minMileage,
      maxMileage: next.maxMileage,
    });
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

  const rangeFilterCount = Object.values(rangeFilters).filter(Boolean).length;
  const activeFilterCount =
    [category, status, transmission].filter(Boolean).length + rangeFilterCount;

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

  function openDetail(car: Car) {
    setDetailCarId(car.id);
  }

  function openCalendar(car: Car) {
    setCalendarCar(car);
  }

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  const exportMutation = useMutation({
    mutationFn: () =>
      carsApi.exportCsv({
        search: search || undefined,
        category,
        status,
        transmission,
        sortBy,
        sortOrder,
        minDailyRate: rangeFilters.minDailyRate ? Number(rangeFilters.minDailyRate) : undefined,
        maxDailyRate: rangeFilters.maxDailyRate ? Number(rangeFilters.maxDailyRate) : undefined,
        minYear: rangeFilters.minYear ? Number(rangeFilters.minYear) : undefined,
        maxYear: rangeFilters.maxYear ? Number(rangeFilters.maxYear) : undefined,
        minMileage: rangeFilters.minMileage ? Number(rangeFilters.minMileage) : undefined,
        maxMileage: rangeFilters.maxMileage ? Number(rangeFilters.maxMileage) : undefined,
      }),
    onSuccess: (blob) => {
      saveBlobAsFile(blob, `voitures-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('Export CSV téléchargé.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Erreur lors de l'export.");
    },
  });

  const columns = useMemo(
    () =>
      buildColumns(
        openEditForm,
        openImageManager,
        openDetail,
        openCalendar,
        { sortBy, sortOrder },
        handleSort,
      ),
    // handleSort is recreated every render but only ever reads sortBy/sortOrder
    // (already tracked here) and the stable setSearchParams — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortOrder],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);

  return (
    <PageContainer>
      <PageHeader
        title="Gestion des voitures"
        description="Ajoutez, modifiez et suivez la disponibilité de votre flotte de véhicules."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => exportMutation.mutate()}
              disabled={exportMutation.isPending}
            >
              <Download className="h-4 w-4" />
              Exporter
            </Button>
            <Button onClick={openCreateForm}>
              <Plus className="h-4 w-4" />
              Ajouter une voiture
            </Button>
          </div>
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
            onValueChange={(value) =>
              updateParam('category', value === ALL_VALUE ? undefined : value)
            }
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
            onValueChange={(value) =>
              updateParam('status', value === ALL_VALUE ? undefined : value)
            }
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
            onValueChange={(value) =>
              updateParam('transmission', value === ALL_VALUE ? undefined : value)
            }
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

          <CarRangeFilters
            value={rangeFilters}
            onApply={applyRangeFilters}
            activeCount={rangeFilterCount}
          />
        </FilterBar>

        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-1">
          <Button
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            aria-label="Vue tableau"
            onClick={() => changeViewMode('table')}
          >
            <Table2 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon"
            className="h-7 w-7"
            aria-label="Vue grille"
            onClick={() => changeViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {viewMode === 'table' && (
        <CarBulkActionsBar selectedIds={selectedIds} onClearSelection={() => setRowSelection({})} />
      )}

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
          {viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer"
                      onClick={() => openDetail(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          onClick={
                            cell.column.id === 'actions' || cell.column.id === 'select'
                              ? (e) => e.stopPropagation()
                              : undefined
                          }
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <CarGrid
              cars={data.items}
              onEdit={openEditForm}
              onManageImages={openImageManager}
              onViewDetails={openDetail}
              onOpenCalendar={openCalendar}
            />
          )}

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
      <CarDetailSheet
        open={Boolean(detailCarId)}
        onOpenChange={(next) => !next && setDetailCarId(undefined)}
        carId={detailCarId}
      />
      <CarCalendarDialog
        open={Boolean(calendarCar)}
        onOpenChange={(next) => !next && setCalendarCar(undefined)}
        car={calendarCar}
      />
    </PageContainer>
  );
}

export default CarsPage;
