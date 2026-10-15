import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hourglass, ScrollText } from 'lucide-react';
import type { ApprovalStatus } from '@car-rental/shared';

import { useFormatMoney } from '@/hooks/use-format-money';
import { useCan } from '@/hooks/use-can';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { FilterBar } from '@/components/common/filter-bar';
import { LoadingState } from '@/components/common/loading-state';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { Pagination } from '@/components/common/pagination';
import { useTeamQuery } from '@/features/team/hooks/use-team';
import { ApprovalDecisionButtons } from '@/features/approvals/components/approval-decision-buttons';
import { useApprovalsQuery, usePendingApprovalsQuery } from '@/features/approvals/hooks/use-approvals';
import { APPROVAL_STATUS_LABELS } from '@/features/approvals/lib/describe-approval';

import type { ActivityEntry } from '../api/activity.api';
import { ActivityFiltersPopover, type ActivityFilters } from '../components/activity-filters-popover';
import { ActivityRow } from '../components/activity-row';
import { useActivityQuery } from '../hooks/use-activity';
import { describeActivity } from '../lib/describe-activity';

const PAGE_SIZE = 30;

function dayLabel(value: string): string {
  const day = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (day.toDateString() === yesterday.toDateString()) return 'Hier';
  return day.toLocaleDateString('fr-TN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function groupByDay(entries: ActivityEntry[]) {
  const groups: { label: string; entries: ActivityEntry[] }[] = [];
  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.entries.push(entry);
    else groups.push({ label, entries: [entry] });
  }
  return groups;
}

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  PENDING: 'bg-warning/15 text-warning-foreground dark:text-warning',
  APPROVED: 'bg-success/15 text-green-700 dark:text-success',
  REJECTED: 'bg-destructive/15 text-red-700 dark:text-destructive',
  WITHDRAWN: 'bg-muted text-muted-foreground',
};

function ApprovalStatusBadge({ status }: { status: ApprovalStatus }) {
  return (
    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', STATUS_STYLE[status])}>
      {APPROVAL_STATUS_LABELS[status]}
    </span>
  );
}

// The director's view of everything done in the agency — who did what and
// when, newest first, filterable by person, kind of activity and period.
// Sign-ins and account changes stay out unless asked for.
export function ActivityPage() {
  const formatMoney = useFormatMoney();
  // The director reads the whole agency; an employee, "Mon activité".
  const canViewAll = useCan('audit.view');
  const { data: team } = useTeamQuery({ enabled: canViewAll });
  // ?userId= opens the journal on one member (the dashboard's team tiles).
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<ActivityFilters>(() => ({
    userId: canViewAll ? (searchParams.get('userId') ?? undefined) : undefined,
  }));
  const [page, setPage] = useState(1);

  const params = { page, pageSize: PAGE_SIZE, ...filters };
  const activeFilterCount = [filters.userId, filters.category, filters.from || filters.to].filter(Boolean).length;
  const { data, isLoading, isError, refetch } = useActivityQuery(params);

  const names = useMemo(() => new Map(team?.map((m) => [m.id, m.fullName]) ?? []), [team]);
  const format = useMemo(
    () => ({ money: formatMoney, userName: (id: string | null) => (id ? (names.get(id) ?? null) : null) }),
    [formatMoney, names],
  );
  const groups = data ? groupByDay(data.items) : [];
  // Where each request stands, to put Valider/Refuser on the ones still
  // waiting and the outcome on the others.
  const { data: approvals } = useApprovalsQuery();
  const { data: pending } = usePendingApprovalsQuery();
  const requestStatus = useMemo(() => new Map(approvals?.map((a) => [a.id, a.status]) ?? []), [approvals]);
  const pendingIds = useMemo(() => new Set(pending?.map((a) => a.id) ?? []), [pending]);

  function asideFor(entry: ActivityEntry) {
    if (entry.action !== 'APPROVAL_REQUEST' || !entry.entityId) return undefined;
    if (pendingIds.has(entry.entityId)) return <ApprovalDecisionButtons requestId={entry.entityId} />;
    const status = requestStatus.get(entry.entityId);
    if (!status) return undefined;
    return <ApprovalStatusBadge status={status} />;
  }
  const pageCount = data ? Math.max(Math.ceil(data.meta.total / PAGE_SIZE), 1) : 1;

  function applyFilters(next: ActivityFilters) {
    setFilters(next);
    setPage(1);
  }

  return (
    <PageContainer>
      <PageHero>
        <PageHeader
          title={canViewAll ? "Journal d'activité" : 'Mon activité'}
          description={
            canViewAll ? "Consultez l'historique des actions de votre équipe." : "Retrouvez l'historique de vos actions."
          }
          actions={
            <FilterBar activeCount={activeFilterCount} onClearAll={() => applyFilters({})} className="flex-row-reverse">
              <ActivityFiltersPopover value={filters} onApply={applyFilters} activeCount={activeFilterCount} team={team ?? []} ownOnly={!canViewAll} />
            </FilterBar>
          }
        />
      </PageHero>

      {pendingIds.size > 0 && filters.category !== 'approvals' && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-5 py-3.5">
          <p className="flex items-center gap-2.5 text-sm font-medium">
            <Hourglass className="h-4 w-4 shrink-0 text-warning" />
            {pendingIds.size === 1
              ? '1 demande attend votre validation.'
              : `${pendingIds.size} demandes attendent votre validation.`}
          </p>
          <Button size="sm" variant="outline" onClick={() => applyFilters({ category: 'approvals' })}>
            Afficher les demandes
          </Button>
        </div>
      )}

      {isLoading && <LoadingState message="Chargement du journal..." />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {data && data.items.length === 0 && (
        <EmptyState
          icon={ScrollText}
          title="Aucune activité"
          description="Rien ne correspond à ces filtres. Essayez une autre période ou un autre membre."
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="space-y-4">
            {groups.map((group) => (
              <Card key={group.label}>
                <div className="border-b border-border px-5 py-2.5 text-xs font-semibold capitalize text-muted-foreground">
                  {group.label}
                </div>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {group.entries.map((entry) => (
                      <ActivityRow
                        key={entry.id}
                        entry={entry}
                        described={describeActivity(entry, format)}
                        aside={asideFor(entry)}
                      />
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
          {pageCount > 1 && <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />}
        </>
      )}
    </PageContainer>
  );
}
