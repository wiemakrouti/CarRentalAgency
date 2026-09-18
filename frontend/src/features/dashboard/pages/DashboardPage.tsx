import { CarFront, ClipboardList, Users, Wallet } from 'lucide-react';

import { useFormatMoney } from '@/hooks/use-format-money';
import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { KpiCard } from '@/components/common/kpi-card';
import { ChartCard } from '@/components/common/chart-card';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';

import { useDashboardData } from '../hooks/use-dashboard-data';
import { OccupancyHeatmap } from '../components/occupancy-heatmap';
import { RevenueExpenseChart } from '../components/revenue-expense-chart';

export function DashboardPage() {
  const formatMoney = useFormatMoney();
  const {
    isLoading,
    isError,
    refetch,
    totalCars,
    availableCars,
    activeRentals,
    overdueRentals,
    totalClients,
    newClientsThisMonth,
    monthProfit,
    monthProfitTrend,
    monthlyFinance,
    occupancy,
  } = useDashboardData();

  return (
    <PageContainer>
      <PageHero>
        <PageHeader title="Tableau de bord" description="Vue d'ensemble de l'agence." />

        {isLoading && <LoadingState message="Chargement du tableau de bord..." />}
        {isError && <ErrorState onRetry={refetch} />}

        {!isLoading && !isError && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              variant="satin"
              label="Voitures disponibles"
              value={String(availableCars)}
              icon={CarFront}
              description={`sur ${totalCars} au total`}
            />
            <KpiCard
              variant="satin"
              label="Locations actives"
              value={String(activeRentals)}
              icon={ClipboardList}
              description={overdueRentals > 0 ? `dont ${overdueRentals} en retard de retour` : 'aucune en retard'}
            />
            <KpiCard
              variant="satin"
              label="Clients enregistrés"
              value={String(totalClients)}
              icon={Users}
              description={newClientsThisMonth > 0 ? `+${newClientsThisMonth} ce mois-ci` : 'aucun nouveau ce mois-ci'}
            />
            <KpiCard
              variant="satin"
              label="Bénéfice net"
              value={formatMoney(monthProfit)}
              icon={Wallet}
              trend={
                monthProfitTrend === null
                  ? undefined
                  : {
                      value: `${monthProfitTrend >= 0 ? '+' : ''}${monthProfitTrend.toFixed(0)}%`,
                      direction: monthProfitTrend > 0 ? 'up' : monthProfitTrend < 0 ? 'down' : 'neutral',
                    }
              }
              description="vs. mois dernier"
            />
          </div>
        )}
      </PageHero>

      {!isLoading && !isError && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Revenus vs Dépenses"
            description="Évolution des 6 derniers mois"
            actions={
              <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-1))' }} />
                  Revenu
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-5))' }} />
                  Dépenses
                </span>
              </div>
            }
          >
            <RevenueExpenseChart data={monthlyFinance} />
          </ChartCard>

          <ChartCard title="Calendrier de charge" description="Voitures en location par jour · 90 derniers jours">
            <OccupancyHeatmap days={occupancy} totalCars={totalCars} />
          </ChartCard>
        </div>
      )}
    </PageContainer>
  );
}
