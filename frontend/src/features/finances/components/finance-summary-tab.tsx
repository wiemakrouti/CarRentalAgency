import { useState } from 'react';
import { REVENUE_PAYMENT_TYPES, EXPENSE_CATEGORIES } from '@car-rental/shared';
import { Clock, ShieldCheck, TrendingDown, TrendingUp, Wallet } from 'lucide-react';

import { KpiCard } from '@/components/common/kpi-card';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useFinanceSummaryQuery } from '../hooks/use-finance-summary';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_TYPE_LABELS } from '../lib/finance-labels';

function formatMoney(amount: number): string {
  return `${amount.toLocaleString('fr-TN')} DT`;
}

function firstDayOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FinanceSummaryTab() {
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(today());

  const { data, isLoading, isError, refetch } = useFinanceSummaryQuery(from, to);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="from">Du</Label>
          <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="to">Au</Label>
          <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading && <LoadingState message="Calcul du résumé..." />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {!isLoading && !isError && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Revenus" value={formatMoney(data.revenue.total)} icon={TrendingUp} />
            <KpiCard label="Dépenses" value={formatMoney(data.expenses.total)} icon={TrendingDown} />
            <KpiCard
              label="Résultat net"
              value={formatMoney(data.net)}
              icon={Wallet}
              trend={{ value: data.net >= 0 ? 'Positif' : 'Négatif', direction: data.net >= 0 ? 'up' : 'down' }}
            />
            <KpiCard
              label="Paiements en attente"
              value={formatMoney(data.pendingTotal)}
              icon={Clock}
              description="À encaisser sur la période"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">Revenus par type</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {REVENUE_PAYMENT_TYPES.map((type) => (
                      <TableRow key={type}>
                        <TableCell>{PAYMENT_TYPE_LABELS[type]}</TableCell>
                        <TableCell className="text-right">{formatMoney(data.revenue.byType[type])}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="shadow-xs">
              <CardHeader>
                <CardTitle className="text-base">Dépenses par catégorie</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <TableRow key={category}>
                        <TableCell>{EXPENSE_CATEGORY_LABELS[category]}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(data.expenses.byCategory[category])}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Cautions are a refundable hold, not agency income — tracked
              here, separately from "Revenus"/"Revenus par type" above, so
              collecting then fully refunding one stays visible without ever
              inflating the revenue total (see REVENUE_PAYMENT_TYPES's own
              comment). */}
          <Card className="shadow-xs">
            <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                Cautions (hors revenus)
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">Encaissées</span>
                <span className="font-semibold text-foreground">{formatMoney(data.deposits.collected)}</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm text-muted-foreground">Remboursées</span>
                <span className="font-semibold text-foreground">{formatMoney(data.deposits.refunded)}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
