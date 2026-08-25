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
import { CarFront, ClipboardList, Users, Wallet } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { KpiCard } from '@/components/common/kpi-card';
import { ChartCard } from '@/components/common/chart-card';

const revenueData = [
  { month: 'Jan', revenue: 8200 },
  { month: 'Fév', revenue: 9100 },
  { month: 'Mar', revenue: 8700 },
  { month: 'Avr', revenue: 10300 },
  { month: 'Mai', revenue: 11200 },
  { month: 'Juin', revenue: 12450 },
];

const categoryData = [
  { category: 'Citadine', count: 14 },
  { category: 'Berline', count: 9 },
  { category: 'SUV', count: 6 },
  { category: 'Utilitaire', count: 3 },
];

const totalCategoryCount = categoryData.reduce((sum, d) => sum + d.count, 0);

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  borderColor: 'hsl(var(--border))',
  borderRadius: 'var(--radius)',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '13px',
};

export function DashboardPage() {
  return (
    <PageContainer>
      <PageHero>
        <PageHeader title="Tableau de bord" description="Vue d'ensemble de l'agence." />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Voitures disponibles"
            value="24"
            icon={CarFront}
            trend={{ value: '+3', direction: 'up' }}
            description="vs. mois dernier"
          />
          <KpiCard
            label="Locations actives"
            value="8"
            icon={ClipboardList}
            trend={{ value: '+2', direction: 'up' }}
            description="vs. mois dernier"
          />
          <KpiCard
            label="Clients actifs"
            value="128"
            icon={Users}
            trend={{ value: '+12', direction: 'up' }}
            description="vs. mois dernier"
          />
          <KpiCard
            label="Revenu du mois"
            value="12 450 DT"
            icon={Wallet}
            trend={{ value: '+11%', direction: 'up' }}
            description="vs. mois dernier"
          />
        </div>
      </PageHero>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Revenu mensuel" description="Évolution des 6 derniers mois (données d'exemple)">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
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

        <ChartCard
          title="Locations par catégorie"
          description="Répartition du parc actif (données d'exemple)"
        >
          <div className="flex h-full items-center gap-6">
            <div className="relative h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="count"
                    nameKey="category"
                    innerRadius={52}
                    outerRadius={74}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={entry.category} fill={`hsl(var(--chart-${(index % 5) + 1}))`} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [value, 'Voitures']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold text-foreground">{totalCategoryCount}</span>
                <span className="text-[10px] text-muted-foreground">voitures</span>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              {categoryData.map((entry, index) => (
                <div key={entry.category} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: `hsl(var(--chart-${(index % 5) + 1}))` }}
                  />
                  <span className="flex-1 text-muted-foreground">{entry.category}</span>
                  <span className="font-semibold text-foreground">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>
    </PageContainer>
  );
}
