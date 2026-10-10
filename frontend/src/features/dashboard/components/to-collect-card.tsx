import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

import { useFormatMoney } from '@/hooks/use-format-money';
import { useQuickActions } from '@/providers/quick-actions-context';
import { PaymentFormDialog } from '@/features/finances/components/payment-form-dialog';
import type { ToCollectSummary } from '@/features/rentals/api/rentals.api';
import { buildBalance } from '@/features/rentals/lib/rental-balance';

import { GaugeCard } from './gauge-card';
import { ToCollectDialog, type ToCollectRow } from './to-collect-dialog';

// The money side of the dashboard, which the fleet planning doesn't show:
// what clients still owe, and how much of what was billed over the same
// window is already collected. The whole card opens the detailed list,
// whose "Encaisser" runs the same payment form as the Rentals page.
export function ToCollectCard({ summary }: { summary: ToCollectSummary }) {
  const formatMoney = useFormatMoney();
  const { openRental } = useQuickActions();
  const [listOpen, setListOpen] = useState(false);
  const [collecting, setCollecting] = useState<ToCollectRow | null>(null);

  const rows = summary.rentals.map((rental) => ({ rental, balance: buildBalance(rental) }));
  const total = rows.reduce((sum, row) => sum + row.balance.remaining, 0);
  const collectedPercent = summary.billedAmount > 0 ? (summary.collectedAmount / summary.billedAmount) * 100 : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setListOpen(true)}
        aria-label="Voir les montants à encaisser"
        className="block h-full w-full rounded-xl text-left transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <GaugeCard
          label="À encaisser"
          value={formatMoney(total)}
          percent={collectedPercent}
          percentLabel="encaissé"
          tone="success"
        >
          <p className="text-xs text-muted-foreground">
            {rows.length > 0
              ? `${rows.length} location${rows.length > 1 ? 's' : ''} impayée${rows.length > 1 ? 's' : ''}`
              : 'Tout est encaissé'}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
            Voir la liste <ArrowRight className="h-3 w-3" />
          </span>
        </GaugeCard>
      </button>

      <ToCollectDialog
        open={listOpen}
        onOpenChange={setListOpen}
        rows={rows}
        onCollect={setCollecting}
        onOpenRental={(rentalId) => {
          setListOpen(false);
          openRental(rentalId);
        }}
      />

      {collecting && (
        <PaymentFormDialog
          open
          onOpenChange={(open) => !open && setCollecting(null)}
          rentalId={collecting.rental.id}
          defaultType="RENTAL_PAYMENT"
          defaultAmount={collecting.balance.remaining}
        />
      )}
    </>
  );
}
