import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useSearchParams } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import {
  CarFront,
  Download,
  FileSpreadsheet,
  FileText,
  ImageOff,
  LayoutGrid,
  Plus,
  Table2,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiClientError } from '@/lib/api-client';
import { saveBlobAsFile } from '@/lib/download-file';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { FilterBar } from '@/components/common/filter-bar';
import { Pagination } from '@/components/common/pagination';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { CarStatusBadge } from '../components/car-status-badge';
import { CarFormDialog } from '../components/car-form-dialog';
import { CarImageManagerDialog } from '../components/car-image-manager-dialog';
import { CarDetailSheet } from '../components/car-detail-sheet';
import { CarCalendarDialog } from '../components/car-calendar-dialog';
import { CarGrid } from '../components/car-grid';
import { CarExpiryAlerts } from '../components/car-expiry-alerts';
import { CarFiltersPopover, type CarFilters } from '../components/car-filters-popover';
import { SortableHeader } from '../components/sortable-header';
import { CAR_CATEGORY_LABELS } from '../lib/car-labels';

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
      id: 'thumbnail',
      header: '',
      cell: ({ row }) => {
        const primary = row.original.images.find((img) => img.isPrimary) ?? row.original.images[0];
        return primary ? (
          <img src={primary.url} alt="" className="h-11 w-16 rounded-lg object-cover shadow-sm" />
        ) : (
          <div className="flex h-11 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-primary-100 to-primary-50">
            <ImageOff className="h-4 w-4 text-primary-300" />
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
      cell: ({ row }) => (
        <div className="space-y-0.5">
          <CarStatusBadge car={row.original} />
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
  const [calendarState, setCalendarState] = useState<
    { car: Car; defaultTab: 'calendar' | 'history' } | undefined
  >(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>(readStoredViewMode);

  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const transmission = searchParams.get('transmission') ?? undefined;
  const sortBy = (searchParams.get('sortBy') as CarSortField | null) ?? 'createdAt';
  const sortOrder = (searchParams.get('sortOrder') as SortOrder | null) ?? 'desc';
  const filters: CarFilters = {
    category,
    status,
    transmission,
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
    minDailyRate: filters.minDailyRate ? Number(filters.minDailyRate) : undefined,
    maxDailyRate: filters.maxDailyRate ? Number(filters.maxDailyRate) : undefined,
    minYear: filters.minYear ? Number(filters.minYear) : undefined,
    maxYear: filters.maxYear ? Number(filters.maxYear) : undefined,
    minMileage: filters.minMileage ? Number(filters.minMileage) : undefined,
    maxMileage: filters.maxMileage ? Number(filters.maxMileage) : undefined,
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

  function applyFilters(next: CarFilters) {
    updateParams({
      category: next.category,
      status: next.status,
      transmission: next.transmission,
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

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function openCreateForm() {
    setEditingCar(undefined);
    setFormOpen(true);
  }

  function openEditForm(car: Car) {
    setEditingCar(car);
    setFormOpen(true);
  }

  function openImageManager(carId: string) {
    setImageManagerCarId(carId);
  }

  function openDetail(car: Car) {
    setDetailCarId(car.id);
  }

  function openCalendar(car: Car, defaultTab: 'calendar' | 'history' = 'calendar') {
    setCalendarState({ car, defaultTab });
  }

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  const exportMutation = useMutation({
    mutationFn: (format: 'csv' | 'xlsx') => {
      const params = {
        search: search || undefined,
        category,
        status,
        transmission,
        sortBy,
        sortOrder,
        minDailyRate: filters.minDailyRate ? Number(filters.minDailyRate) : undefined,
        maxDailyRate: filters.maxDailyRate ? Number(filters.maxDailyRate) : undefined,
        minYear: filters.minYear ? Number(filters.minYear) : undefined,
        maxYear: filters.maxYear ? Number(filters.maxYear) : undefined,
        minMileage: filters.minMileage ? Number(filters.minMileage) : undefined,
        maxMileage: filters.maxMileage ? Number(filters.maxMileage) : undefined,
      };
      return format === 'xlsx' ? carsApi.exportXlsx(params) : carsApi.exportCsv(params);
    },
    onSuccess: (blob, format) => {
      const date = new Date().toISOString().slice(0, 10);
      saveBlobAsFile(blob, `voitures-${date}.${format}`);
      toast.success(format === 'xlsx' ? 'Export Excel téléchargé.' : 'Export CSV téléchargé.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Erreur lors de l'export.");
    },
  });

  const columns = useMemo(
    () =>
      buildColumns(openEditForm, openDetail, openCalendar, { sortBy, sortOrder }, handleSort),
    // handleSort is recreated every render but only ever reads sortBy/sortOrder
    // (already tracked here) and the stable setSearchParams — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sortBy, sortOrder],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <PageContainer>
      <PageHero>
        <PageHeader
          title="Gestion des voitures"
          description="Ajoutez, modifiez et suivez la disponibilité de votre flotte de véhicules."
          actions={
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={exportMutation.isPending}>
                    <Download className="h-4 w-4" />
                    Exporter
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportMutation.mutate('csv')}>
                    <FileText className="h-4 w-4" />
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportMutation.mutate('xlsx')}>
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel (.xlsx)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            <CarFiltersPopover value={filters} onApply={applyFilters} activeCount={activeFilterCount} />
          </FilterBar>

          <div className="ml-auto flex items-center gap-1 rounded-xl bg-muted p-1">
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="icon"
              className={viewMode === 'table' ? 'h-7 w-7 shadow-sm' : 'h-7 w-7 hover:bg-background/60'}
              aria-label="Vue tableau"
              onClick={() => changeViewMode('table')}
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="icon"
              className={viewMode === 'grid' ? 'h-7 w-7 shadow-sm' : 'h-7 w-7 hover:bg-background/60'}
              aria-label="Vue grille"
              onClick={() => changeViewMode('grid')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </PageHero>

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
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-elevation">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={header.column.id === 'dailyRate' ? 'text-right' : undefined}
                        >
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
                          className={
                            cell.column.id === 'dailyRate' ? 'text-right tabular-nums' : undefined
                          }
                          onClick={
                            cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined
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
        onManageImages={() => detailCarId && openImageManager(detailCarId)}
        onOpenCalendar={() => {
          const car = data?.items.find((c) => c.id === detailCarId);
          if (car) {
            // Swap the sheet for the dialog rather than stacking both overlays.
            setDetailCarId(undefined);
            openCalendar(car, 'history');
          }
        }}
      />
      <CarCalendarDialog
        open={Boolean(calendarState)}
        onOpenChange={(next) => !next && setCalendarState(undefined)}
        car={calendarState?.car}
        defaultTab={calendarState?.defaultTab}
      />
    </PageContainer>
  );
}

export default CarsPage;
