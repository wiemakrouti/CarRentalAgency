import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useClientsQuery } from '../hooks/use-clients';
import { clientsApi, type Client, type ClientLicenseStatus, type ClientSortField, type SortOrder } from '../api/clients.api';
import { clientKeys } from '../api/clients.keys';
import { ClientRowActions } from '../components/client-row-actions';
import { ClientFormDialog } from '../components/client-form-dialog';
import { ClientDocumentManagerDialog } from '../components/client-document-manager-dialog';
import { ClientProfileSheet } from '../components/client-profile-sheet';
import { ClientCalendarDialog } from '../components/client-calendar-dialog';
import { ClientReliabilityBadge } from '../components/client-reliability-badge';
import { ClientFiltersPopover, type ClientFilters } from '../components/client-filters-popover';
import { SortableHeader } from '../components/sortable-header';

const PAGE_SIZE = 20;

const columnHelper = createColumnHelper<Client>();

type SortState = { sortBy: ClientSortField; sortOrder: SortOrder };

function buildColumns(
  onEdit: (client: Client) => void,
  onManageDocuments: (client: Client) => void,
  onViewProfile: (client: Client) => void,
  onOpenCalendar: (client: Client) => void,
  sort: SortState,
  onSort: (field: ClientSortField) => void,
) {
  function sortableHeader(label: string, field: ClientSortField) {
    return () => (
      <SortableHeader label={label} field={field} sortBy={sort.sortBy} sortOrder={sort.sortOrder} onSort={onSort} />
    );
  }

  return [
    columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
      id: 'fullName',
      header: sortableHeader('Nom complet', 'lastName'),
      cell: ({ row }) => {
        const { firstName, lastName } = row.original;
        const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700 dark:bg-primary/15 dark:text-primary">
              {initials}
            </div>
            <span className="font-medium">
              {firstName} {lastName}
            </span>
          </div>
        );
      },
    }),
    columnHelper.accessor('phone', { header: 'Téléphone' }),
    columnHelper.accessor('address', {
      header: 'Adresse',
      cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
    }),
    columnHelper.accessor('nationalIdNumber', {
      header: 'N° CIN',
      cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
    }),
    columnHelper.accessor('drivingLicenseNumber', { header: 'N° Permis' }),
    columnHelper.display({
      id: 'reliability',
      header: 'Comportement',
      cell: ({ row }) => <ClientReliabilityBadge client={row.original} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <ClientRowActions
          client={row.original}
          onEdit={onEdit}
          onManageDocuments={onManageDocuments}
          onViewProfile={onViewProfile}
          onOpenCalendar={onOpenCalendar}
        />
      ),
    }),
  ];
}

export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  const [editingFocusField, setEditingFocusField] = useState<'drivingLicenseExpiry' | undefined>(undefined);
  const [documentManagerClientId, setDocumentManagerClientId] = useState<string | undefined>(undefined);
  const [profileClientId, setProfileClientId] = useState<string | undefined>(undefined);
  const [calendarState, setCalendarState] = useState<
    { client: Client; defaultTab: 'calendar' | 'history' } | undefined
  >(undefined);

  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const city = searchParams.get('city') ?? undefined;
  const licenseStatus = (searchParams.get('licenseStatus') as ClientLicenseStatus | null) ?? undefined;
  const sortBy = (searchParams.get('sortBy') as ClientSortField | null) ?? 'createdAt';
  const sortOrder = (searchParams.get('sortOrder') as SortOrder | null) ?? 'desc';
  // One-shot deep link — e.g. from a notification about this client's
  // driving license expiring. Opens the profile sheet directly instead of
  // landing on the list and making the admin find the row themselves (same
  // pattern as Rentals' returnRentalId / Cars' openId).
  const openId = searchParams.get('openId');

  const filters: ClientFilters = { city, licenseStatus };

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = useClientsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    city,
    licenseStatus,
    sortBy,
    sortOrder,
  });
  // Not useClientQuery: this is a one-shot "does it still exist" check, and
  // a 404 here isn't transient — retrying it (the shared hook's default)
  // only delays isError from ever becoming true, leaving the effect below
  // waiting indefinitely instead of surfacing the "gone" toast.
  const { data: deepLinkedClient, isError: deepLinkedClientError } = useQuery({
    queryKey: clientKeys.detail(openId ?? ''),
    queryFn: () => clientsApi.getById(openId!),
    enabled: Boolean(openId),
    retry: false,
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

  function handleSort(field: ClientSortField) {
    if (sortBy !== field) {
      updateParams({ sortBy: field, sortOrder: 'asc' });
    } else {
      updateParams({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    }
  }

  function applyFilters(next: ClientFilters) {
    updateParams({ city: next.city, licenseStatus: next.licenseStatus });
  }

  useEffect(() => {
    if (debouncedSearch !== search) {
      updateParam('search', debouncedSearch || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, search]);

  useEffect(() => {
    if (!openId || (!deepLinkedClient && !deepLinkedClientError)) return;
    if (deepLinkedClient) {
      setProfileClientId(deepLinkedClient.id);
    } else {
      // A notification pointing at a since-deleted client — surface why
      // nothing opened instead of a silent dead click.
      toast.warning("Ce client n'existe plus.");
    }
    // One-shot either way: drop openId so closing and reopening the sheet
    // later (or navigating back here) doesn't retry/reopen it every time.
    const next = new URLSearchParams(searchParams);
    next.delete('openId');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedClient, deepLinkedClientError]);

  function clearAllFilters() {
    setSearchInput('');
    setSearchParams({});
  }

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  function openCreateForm() {
    setEditingClient(undefined);
    setEditingFocusField(undefined);
    setFormOpen(true);
  }

  function openEditForm(client: Client, focusField?: 'drivingLicenseExpiry') {
    setEditingClient(client);
    setEditingFocusField(focusField);
    setFormOpen(true);
  }

  function openDocumentManager(client: Client) {
    setDocumentManagerClientId(client.id);
  }

  function openProfile(client: Client) {
    setProfileClientId(client.id);
  }

  function openCalendar(client: Client, defaultTab: 'calendar' | 'history' = 'calendar') {
    setCalendarState({ client, defaultTab });
  }

  const exportMutation = useMutation({
    mutationFn: (format: 'csv' | 'xlsx') => {
      const params = {
        search: search || undefined,
        city,
        licenseStatus,
        sortBy,
        sortOrder,
      };
      return format === 'xlsx' ? clientsApi.exportXlsx(params) : clientsApi.exportCsv(params);
    },
    onSuccess: (blob, format) => {
      const date = new Date().toISOString().slice(0, 10);
      saveBlobAsFile(blob, `clients-${date}.${format}`);
      toast.success(format === 'xlsx' ? 'Export Excel téléchargé.' : 'Export CSV téléchargé.');
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Erreur lors de l'export.");
    },
  });

  const columns = useMemo(
    () =>
      buildColumns(
        openEditForm,
        openDocumentManager,
        openProfile,
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
  });

  return (
    <PageContainer>
      <PageHero>
        <PageHeader
          title="Gestion des clients"
          description="Gérez les profils, documents et statut de vos clients."
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
                Ajouter un client
              </Button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Rechercher par nom, téléphone, email ou permis..."
            className="w-80"
          />
          <FilterBar activeCount={activeFilterCount} onClearAll={clearAllFilters}>
            <ClientFiltersPopover value={filters} onApply={applyFilters} activeCount={activeFilterCount} />
          </FilterBar>
        </div>
      </PageHero>

      {isLoading && <LoadingState message="Chargement des clients..." />}

      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && data && data.items.length === 0 && (
        <EmptyState
          icon={Users}
          title="Aucun client trouvé"
          description="Essayez de modifier vos filtres ou ajoutez un nouveau client."
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
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => openProfile(row.original)}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
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
            onPageChange={(nextPage) => updateParam('page', String(nextPage))}
          />
        </>
      )}

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editingClient}
        focusField={editingFocusField}
      />
      <ClientDocumentManagerDialog
        open={Boolean(documentManagerClientId)}
        onOpenChange={(next) => !next && setDocumentManagerClientId(undefined)}
        clientId={documentManagerClientId}
      />
      <ClientProfileSheet
        open={Boolean(profileClientId)}
        onOpenChange={(next) => !next && setProfileClientId(undefined)}
        clientId={profileClientId}
        onEdit={(client, focusField) => openEditForm(client, focusField)}
        onManageDocuments={() => setDocumentManagerClientId(profileClientId)}
        onOpenCalendar={(client) => {
          // Swap the sheet for the dialog rather than stacking both overlays.
          setProfileClientId(undefined);
          openCalendar(client, 'history');
        }}
      />
      <ClientCalendarDialog
        open={Boolean(calendarState)}
        onOpenChange={(next) => !next && setCalendarState(undefined)}
        client={calendarState?.client}
        defaultTab={calendarState?.defaultTab}
      />
    </PageContainer>
  );
}

export default ClientsPage;
