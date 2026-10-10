import { PageContainer } from '@/components/common/page-container';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';

import { useDashboardData } from '../hooks/use-dashboard-data';
import { FinanceChartCard } from '../components/finance-chart-card';
import { DashboardHeader } from '../components/dashboard-header';
import { FleetPlanning } from '../components/fleet-planning';
import { ToCollectCard } from '../components/to-collect-card';
import { ProfitCard } from '../components/profit-card';

export function DashboardPage() {
  const { isLoading, isError, refetch, toCollect, monthRevenue, monthProfit, monthProfitTrend, monthlyFinance } =
    useDashboardData();

  return (
    <PageContainer>
      <DashboardHeader />

      {/* The day's tool first: the whole fleet — who has which car, what's
          late, which days are free to book. */}
      <FleetPlanning />

      {/* Then the money, grouped in one section: the 6-month trend, and
          beside it what's still owed and this month's profit. The cards'
          column never drops below 340px, so their amounts are never cut;
          under xl they move above the chart — the two figures first. */}
      {isLoading && <LoadingState message="Chargement des finances..." />}
      {isError && <ErrorState onRetry={refetch} />}
      {!isLoading && !isError && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
          <FinanceChartCard data={monthlyFinance} />

          <div className="order-first grid gap-4 md:grid-cols-2 xl:order-none xl:grid-cols-1 xl:grid-rows-2">
            <ToCollectCard summary={toCollect} />
            <ProfitCard profit={monthProfit} revenue={monthRevenue} trend={monthProfitTrend} />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
