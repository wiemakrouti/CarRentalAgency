import { ArrowRight, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function formatMoney(amount: number): string {
  return `${amount.toLocaleString('fr-TN')} DT`;
}

type DepositsCardProps = {
  collected: number;
  refunded: number;
  onViewDetails: () => void;
};

// All-time figures — this card deliberately ignores the Résumé tab's date
// filter (see FinanceSummaryService.getSummary). Encaissées is every
// caution ever collected; the capsule splits it into Remboursées and
// Encore retenu (collected − refunded = what's still with the clients).
export function DepositsCard({ collected, refunded, onViewDetails }: DepositsCardProps) {
  const held = Math.max(collected - refunded, 0);
  const refundedPct = collected > 0 ? Math.min(refunded / collected, 1) * 100 : 0;

  return (
    <Card className="shadow-xs">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Cautions
          </CardTitle>
          <CardDescription>Retenues temporaires remboursables, distinctes du chiffre d'affaires.</CardDescription>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={onViewDetails}>
          Voir le détail
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {collected <= 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Aucune caution encaissée pour l'instant.</p>
        ) : (
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-0 sm:divide-x sm:divide-border">
            {/* Encaissées — total ever collected */}
            <div className="flex items-center gap-3.5 sm:shrink-0 sm:pr-8">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 shadow-[0_0_0_1px_hsl(var(--primary-100)),0_8px_20px_-8px_hsl(var(--primary)/0.5)] dark:bg-primary/15 dark:shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_8px_20px_-8px_hsl(var(--primary)/0.4)]">
                <ShieldCheck className="h-5 w-5 text-primary" />
              </span>
              <div>
                <p className="text-2xl font-extrabold leading-none tracking-tight tabular-nums text-foreground">
                  {formatMoney(collected)}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">Encaissées</p>
              </div>
            </div>

            {/* Remboursées vs Encore retenu */}
            <div className="min-w-0 flex-1 sm:pl-8">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-xs">
                <span className="flex items-baseline gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 self-center rounded-full bg-success" />
                  Remboursées
                  <span className="font-bold tabular-nums text-success">{formatMoney(refunded)}</span>
                </span>
                <span className="flex items-baseline gap-1.5 text-muted-foreground">
                  <span className="h-2 w-2 shrink-0 self-center rounded-full bg-primary-500" />
                  Encore retenu
                  <span className="font-bold tabular-nums text-primary-500">{formatMoney(held)}</span>
                </span>
              </div>
              <div className="flex h-7 gap-1">
                {refunded > 0 && (
                  <div
                    className="rounded-l-[9px] rounded-r-[3px] bg-gradient-to-b from-success to-success/85"
                    style={{ width: `${refundedPct}%` }}
                  />
                )}
                {held > 0 && (
                  <div
                    className={`flex-1 rounded-r-[9px] bg-gradient-to-b from-primary-500 to-primary-700 ${
                      refunded > 0 ? 'rounded-l-[3px]' : 'rounded-l-[9px]'
                    }`}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
