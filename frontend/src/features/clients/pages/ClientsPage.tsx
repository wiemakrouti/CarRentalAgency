import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { Plus, Users } from 'lucide-react';

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

import { useClientsQuery } from '../hooks/use-clients';
import type { Client } from '../api/clients.api';
import { ClientRowActions } from '../components/client-row-actions';
import { ClientFormDialog } from '../components/client-form-dialog';
import { ClientDocumentManagerDialog } from '../components/client-document-manager-dialog';

const ALL_VALUE = '__all__';
const PAGE_SIZE = 20;

const columnHelper = createColumnHelper<Client>();

function buildColumns(onEdit: (client: Client) => void, onManageDocuments: (client: Client) => void) {
  return [
    columnHelper.accessor((row) => `${row.firstName} ${row.lastName}`, {
      id: 'fullName',
      header: 'Nom complet',
    }),
    columnHelper.accessor('phone', { header: 'Téléphone' }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: ({ getValue }) => getValue() ?? <span className="text-muted-foreground">—</span>,
    }),
    columnHelper.accessor('drivingLicenseNumber', { header: 'Permis' }),
    columnHelper.accessor('blacklisted', {
      header: 'Statut',
      cell: ({ getValue }) =>
        getValue() ? (
          <Badge variant="destructive">Liste noire</Badge>
        ) : (
          <Badge variant="success">Actif</Badge>
        ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <ClientRowActions client={row.original} onEdit={onEdit} onManageDocuments={onManageDocuments} />
      ),
    }),
  ];
}

export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);
  const [documentManagerClientId, setDocumentManagerClientId] = useState<string | undefined>(undefined);

  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const blacklisted = searchParams.get('blacklisted') ?? undefined;

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = useClientsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    blacklisted: blacklisted === undefined ? undefined : blacklisted === 'true',
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

  const activeFilterCount = blacklisted ? 1 : 0;

  function openCreateForm() {
    setEditingClient(undefined);
    setFormOpen(true);
  }

  function openEditForm(client: Client) {
    setEditingClient(client);
    setFormOpen(true);
  }

  function openDocumentManager(client: Client) {
    setDocumentManagerClientId(client.id);
  }

  const columns = useMemo(() => buildColumns(openEditForm, openDocumentManager), []);

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Gestion des clients"
        description="Gérez les profils, documents et statut de vos clients."
        actions={
          <Button onClick={openCreateForm}>
            <Plus className="h-4 w-4" />
            Ajouter un client
          </Button>
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
          <Select
            value={blacklisted ?? ALL_VALUE}
            onValueChange={(value) => updateParam('blacklisted', value === ALL_VALUE ? undefined : value)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>Tous les statuts</SelectItem>
              <SelectItem value="false">Actifs</SelectItem>
              <SelectItem value="true">Liste noire</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>
      </div>

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

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editingClient} />
      <ClientDocumentManagerDialog
        open={Boolean(documentManagerClientId)}
        onOpenChange={(next) => !next && setDocumentManagerClientId(undefined)}
        clientId={documentManagerClientId}
      />
    </PageContainer>
  );
}

export default ClientsPage;
