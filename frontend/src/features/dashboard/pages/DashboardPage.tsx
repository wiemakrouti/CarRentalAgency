import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, CarFront, ClipboardList, Users, Wallet } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { KpiCard } from '@/components/common/kpi-card';
import { ChartCard } from '@/components/common/chart-card';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { CAR_CATEGORY_LABELS } from '@/features/cars/lib/car-labels';

import { useDashboardData } from '../hooks/use-dashboard-data';

function formatMoney(amount: number): string {
  return `${amount.toLocaleString('fr-TN')} DT`;
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  borderRadius: 'var(--radius)',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '13px',
};

export function DashboardPage() {
  const {
    isLoading,
    isError,
    refetch,
    totalCars,
    availableCars,
    activeRentals,
    overdueRentals,
    totalClients,
    monthRevenue,
    monthRevenueTrend,
    categoryBreakdown,
    monthlyRevenue,
  } = useDashboardData();

  const totalCategoryCount = categoryBreakdown.reduce((sum, d) => sum + d.count, 0);

  return (
    <PageContainer>
      <PageHero>
        <PageHeader title="Tableau de bord" description="Vue d'ensemble de l'agence." />

        {isLoading && <LoadingState message="Chargement du tableau de bord..." />}
        {isError && <ErrorState onRetry={refetch} />}

        {!isLoading && !isError && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Voitures disponibles"
              value={String(availableCars)}
              icon={CarFront}
              description={`sur ${totalCars} au total`}
            />
            <KpiCard
              label="Locations actives"
              value={String(activeRentals)}
              icon={ClipboardList}
              description={overdueRentals > 0 ? `dont ${overdueRentals} en retard de retour` : 'aucune en retard'}
            />
            <KpiCard label="Clients actifs" value={String(totalClients)} icon={Users} description="Total enregistrés" />
            <KpiCard
              label="Revenu du mois"
              value={formatMoney(monthRevenue)}
              icon={Wallet}
              trend={
                monthRevenueTrend === null
                  ? undefined
                  : {
                      value: `${monthRevenueTrend >= 0 ? '+' : ''}${monthRevenueTrend.toFixed(0)}%`,
                      direction: monthRevenueTrend > 0 ? 'up' : monthRevenueTrend < 0 ? 'down' : 'neutral',
                    }
              }
              description="vs. mois dernier (même période)"
            />
          </div>
        )}
      </PageHero>

      {!isLoading && !isError && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Revenu mensuel" description="Évolution des 6 derniers mois">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenue} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => [`${value.toLocaleString('fr-TN')} DT`, 'Revenu']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Voitures par catégorie" description="Répartition du parc">
            {totalCategoryCount === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <AlertTriangle className="h-5 w-5" />
                Aucune voiture enregistrée.
              </div>
            ) : (
              <div className="flex h-full items-center gap-6">
                <div className="relative h-40 w-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        dataKey="count"
                        nameKey="category"
                        innerRadius={52}
                        outerRadius={74}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={entry.category} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [value, 'Voitures']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-foreground">{totalCategoryCount}</span>
                    <span className="text-[10px] text-muted-foreground">voitures</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2.5">
                  {categoryBreakdown.map((entry, index) => (
                    <div key={entry.category} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))` }}
                      />
                      <span className="flex-1 text-muted-foreground">{CAR_CATEGORY_LABELS[entry.category]}</span>
                      <span className="font-semibold text-foreground">{entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </PageContainer>
  );
}
