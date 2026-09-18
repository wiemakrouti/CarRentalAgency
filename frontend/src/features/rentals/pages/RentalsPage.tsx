import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { flexRender, getCoreRowModel, useReactTable, createColumnHelper } from '@tanstack/react-table';
import { RENTAL_STATUSES } from '@car-rental/shared';
import { ClipboardList, Plus } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useFormatMoney } from '@/hooks/use-format-money';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { EmptyState } from '@/components/common/empty-state';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { SearchBar } from '@/components/common/search-bar';
import { FilterBar } from '@/components/common/filter-bar';
import { Pagination } from '@/components/common/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { toast } from 'sonner';
import { useRentalQuery, useRentalSummaryQuery, useRentalsQuery } from '../hooks/use-rentals';
import { RentalFormDialog } from '../components/rental-form-dialog';
import { RentalRowActions } from '../components/rental-row-actions';
import { RentalDetailSheet } from '../components/rental-detail-sheet';
import { RentalStatusCards } from '../components/rental-status-cards';
import { ReturnRentalDialog } from '../components/return-rental-dialog';
import type { Rental } from '../api/rentals.api';
import { getDisplayRentalStatusSummary } from '../lib/rental-calendar';
import {
  DISPLAY_RENTAL_STATUS_BADGE_VARIANT,
  DISPLAY_RENTAL_STATUS_LABELS,
  RENTAL_STATUS_LABELS,
} from '../lib/rental-labels';

const ALL_VALUE = '__all__';
// Sentinel for the status <Select> — "Départs en retard" isn't a
// RentalStatus (it's RESERVED + pickupDate in the past, same condition as
// the KPI header's own card), so it can't just be another RENTAL_STATUSES
// value. Never sent to the API as-is; selecting it calls selectStatusFilter
// with the real { status: 'RESERVED', pickupOverdue: true } pair instead.
const PICKUP_OVERDUE_VALUE = '__pickup_overdue__';
const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN');
}

const columnHelper = createColumnHelper<Rental>();

function buildColumns(formatMoney: (amount: number) => string) {
  return [
    columnHelper.accessor('rentalNumber', { header: 'N° location' }),
    columnHelper.accessor((row) => `${row.car.brand} ${row.car.model} (${row.car.licensePlate})`, {
      id: 'car',
      header: 'Voiture',
    }),
    columnHelper.accessor((row) => `${row.client.firstName} ${row.client.lastName}`, {
      id: 'client',
      header: 'Client',
      cell: ({ row }) => {
        const { firstName, lastName } = row.original.client;
        const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        return (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50 text-[11px] font-semibold text-primary-700 dark:bg-primary/15 dark:text-primary">
              {initials}
            </div>
            <span>
              {firstName} {lastName}
            </span>
          </div>
        );
      },
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
      // Display status, not the raw column — an ACTIVE rental past its
      // plannedReturnDate reads as OVERDUE and a RESERVED one past its
      // pickupDate reads as PICKUP_OVERDUE everywhere else in the app
      // (calendar dialogs, the notification bell, the detail sheet's stamp);
      // the table shouldn't be the one place that still calls either of them
      // a plain "En cours"/"Réservée".
      cell: ({ row }) => {
        const status = getDisplayRentalStatusSummary(row.original);
        return (
          <Badge variant={DISPLAY_RENTAL_STATUS_BADGE_VARIANT[status]}>{DISPLAY_RENTAL_STATUS_LABELS[status]}</Badge>
        );
      },
    }),
    columnHelper.accessor('totalAmount', {
      header: 'Total',
      // A cancelled reservation's totalAmount is just what it would have
      // cost, frozen at creation — same rule as the Paiement column right
      // next to it, so the two never disagree about whether this row still
      // has a real amount attached.
      cell: ({ getValue, row }) =>
        row.original.status === 'CANCELLED' ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatMoney(Number(getValue()))
        ),
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => <RentalRowActions rental={row.original} />,
    }),
  ];
}

export function RentalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [detailRentalId, setDetailRentalId] = useState<string | undefined>(undefined);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  // Snapshotted once the deep link resolves — kept in local state (not
  // re-derived from the URL) so clearing returnRentalId below doesn't blank
  // it out from under the still-open dialog.
  const [rentalToReturn, setRentalToReturn] = useState<Rental | null>(null);

  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const status = searchParams.get('status') ?? undefined;
  // Set only by clicking a KPI card (see selectStatusFilter below) — never
  // exposed as its own control, since it always travels paired with
  // `status` there. Parsed defensively rather than trusting the URL string.
  const pickupOverdueParam = searchParams.get('pickupOverdue');
  const pickupOverdue = pickupOverdueParam === null ? undefined : pickupOverdueParam === 'true';
  // One-shot deep link from the Cars module's "Consulter la location" —
  // see CarRentedNoticeDialog. Landing here re-opens Return directly on
  // this rental instead of making the admin find it in the list first.
  const returnRentalId = searchParams.get('returnRentalId');
  // One-shot deep link from a notification (return due soon / overdue,
  // missed pickup). Opens the detail sheet directly, same "land on the
  // record, not just the module" intent as Cars'/Clients' openId. Separate
  // from returnRentalId above: a due-soon reminder shouldn't force the
  // Return workflow open the way the Cars flow does — the sheet lets the
  // admin decide what to do from there.
  const openId = searchParams.get('openId');

  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebouncedValue(searchInput);

  const { data, isLoading, isError, refetch } = useRentalsQuery({
    page,
    pageSize: PAGE_SIZE,
    search: search || undefined,
    status,
    pickupOverdue,
  });
  const { data: deepLinkedRental } = useRentalQuery(returnRentalId ?? '');
  const { data: highlightedRental } = useRentalQuery(openId ?? '');
  const { data: summary, isLoading: isSummaryLoading, isError: isSummaryError } = useRentalSummaryQuery();

  function updateParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    // Manually picking a status from the <Select> is a different, broader
    // action than clicking a KPI card — pickupOverdue only ever makes sense
    // paired with the exact status a card set it alongside (see
    // selectStatusFilter), so a manual status change drops it rather than
    // risk the two disagreeing (pickupOverdue takes priority server-side).
    if (key === 'status') next.delete('pickupOverdue');
    setSearchParams(next);
  }

  // Clicking a KPI card shows exactly the rentals it counted — replaces the
  // filters wholesale (including any free-text search) rather than layering
  // on top, since "show me this bucket" is a fresh request, not a
  // refinement of whatever was already typed in the search box.
  function selectStatusFilter(filter: { status: string; pickupOverdue?: boolean }) {
    const next = new URLSearchParams();
    next.set('status', filter.status);
    if (filter.pickupOverdue !== undefined) next.set('pickupOverdue', String(filter.pickupOverdue));
    setSearchInput('');
    setSearchParams(next);
  }

  useEffect(() => {
    if (debouncedSearch !== search) {
      updateParam('search', debouncedSearch || undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, search]);

  useEffect(() => {
    if (!returnRentalId || !deepLinkedRental) return;
    if (deepLinkedRental.status === 'ACTIVE') {
      setRentalToReturn(deepLinkedRental);
      setSearchInput(deepLinkedRental.rentalNumber);
      setReturnDialogOpen(true);
    } else {
      toast.warning('Cette location a déjà été clôturée.');
    }
    // One-shot: drop returnRentalId so re-opening/closing the dialog later
    // doesn't reopen it, and filter the list down to this rental.
    const next = new URLSearchParams(searchParams);
    next.delete('returnRentalId');
    next.set('search', deepLinkedRental.rentalNumber);
    next.delete('page');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkedRental]);

  useEffect(() => {
    if (!openId || !highlightedRental) return;
    setSearchInput(highlightedRental.rentalNumber);
    setDetailRentalId(highlightedRental.id);
    // One-shot: drop openId so it doesn't keep re-filtering the search box
    // (or reopening the sheet) on every render, and filter the list down to
    // this rental.
    const next = new URLSearchParams(searchParams);
    next.delete('openId');
    next.set('search', highlightedRental.rentalNumber);
    next.delete('page');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightedRental]);

  function clearAllFilters() {
    setSearchInput('');
    setSearchParams({});
  }

  const activeFilterCount = status ? 1 : 0;

  const formatMoney = useFormatMoney();
  const columns = useMemo(() => buildColumns(formatMoney), [formatMoney]);

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <PageContainer>
      <PageHero>
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

        {/* Four independent counts mirroring the distinctions the
            notification bell already draws (ACTIVE vs. overdue-return,
            RESERVED vs. overdue-pickup) — a glanceable "what needs
            attention" summary before the table itself. Silently omitted on
            error since it's a supplementary widget, not the page's job. */}
        {isSummaryLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[152px] rounded-[20px]" />
            ))}
          </div>
        )}
        {!isSummaryLoading && !isSummaryError && summary && (
          <RentalStatusCards summary={summary} onSelect={selectStatusFilter} />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Rechercher par n° location, voiture ou client..."
            className="w-80"
          />
          <FilterBar activeCount={activeFilterCount} onClearAll={clearAllFilters}>
            <Select
              value={status === 'RESERVED' && pickupOverdue === true ? PICKUP_OVERDUE_VALUE : (status ?? ALL_VALUE)}
              onValueChange={(value) => {
                if (value === PICKUP_OVERDUE_VALUE) {
                  selectStatusFilter({ status: 'RESERVED', pickupOverdue: true });
                } else {
                  updateParam('status', value === ALL_VALUE ? undefined : value);
                }
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>Tous les statuts</SelectItem>
                {RENTAL_STATUSES.map((s) => (
                  <Fragment key={s}>
                    <SelectItem value={s}>{RENTAL_STATUS_LABELS[s]}</SelectItem>
                    {/* Sub-case of RESERVED — grouped right after it rather
                        than at the end, alongside the other four real
                        statuses. */}
                    {s === 'RESERVED' && (
                      <SelectItem value={PICKUP_OVERDUE_VALUE}>Départs en retard</SelectItem>
                    )}
                  </Fragment>
                ))}
              </SelectContent>
            </Select>
          </FilterBar>
        </div>
      </PageHero>

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
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-elevation">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={header.column.id === 'totalAmount' ? 'text-right' : undefined}
                      >
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                    onClick={() => setDetailRentalId(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cell.column.id === 'totalAmount' ? 'text-right tabular-nums' : undefined}
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

      <RentalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        // Land straight on the new rental's detail sheet — its "+ Ajouter"
        // is already prefilled with what's owed, so a walk-in client who
        // pays on the spot is one click away instead of having to find the
        // row in the list first.
        onCreated={(rental) => setDetailRentalId(rental.id)}
      />
      <RentalDetailSheet
        rentalId={detailRentalId}
        open={Boolean(detailRentalId)}
        onOpenChange={(next) => !next && setDetailRentalId(undefined)}
      />
      {rentalToReturn && (
        <ReturnRentalDialog
          open={returnDialogOpen}
          onOpenChange={(next) => {
            setReturnDialogOpen(next);
            if (!next) setRentalToReturn(null);
          }}
          rental={rentalToReturn}
        />
      )}
    </PageContainer>
  );
}

export default RentalsPage;
