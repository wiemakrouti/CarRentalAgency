import { useState } from 'react';
import { LayoutDashboard, Receipt, ShieldCheck, Wallet } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { FinanceSummaryTab } from '../components/finance-summary-tab';
import { PaymentsTab } from '../components/payments-tab';
import { ExpensesTab } from '../components/expenses-tab';
import { DepositsTab } from '../components/deposits-tab';

// An underline strip, not the shared TabsList's default pill — scoped to
// this call site via className overrides (twMerge resolves the conflicts)
// rather than touching ui/tabs.tsx, which the calendar dialogs and the
// rental form also use as a plain segmented control. `group` lets the icon
// badge below react to this trigger's own active state.
const TAB_TRIGGER_CLASSES =
  'group h-auto shrink-0 gap-2.5 rounded-none border-b-2 border-transparent px-1 py-3 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none';

// The icon badge itself: muted until this tab is active, then fills with a
// blue gradient plus a soft halo — the "Option A1" pick, same glow treatment
// KpiCard already uses on its own icon badges, so the accent reads as part
// of the existing brand language rather than a one-off. The numbered
// primary-500/600 scale doesn't get its own dark-mode values (see
// index.css's `.dark` block), so dark mode falls back to the adaptive
// `--primary` token instead, same escape hatch KpiCard uses.
const TAB_ICON_CLASSES =
  'flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-all group-hover:text-foreground ' +
  'group-data-[state=active]:bg-gradient-to-br group-data-[state=active]:from-primary-500 group-data-[state=active]:to-primary-600 group-data-[state=active]:text-primary-foreground ' +
  'group-data-[state=active]:shadow-[0_0_0_4px_hsl(var(--primary-500)/0.16),0_8px_20px_-6px_hsl(var(--primary-500)/0.65)] ' +
  'dark:group-data-[state=active]:from-primary dark:group-data-[state=active]:to-primary dark:group-data-[state=active]:shadow-[0_0_0_4px_hsl(var(--primary)/0.18),0_8px_20px_-6px_hsl(var(--primary)/0.45)]';

export function FinancesPage() {
  // Controlled (not defaultValue) so the "Vue d'ensemble" tab's "Voir le détail" on
  // Cautions en cours can switch straight to the Cautions tab — a plain
  // callback, not a route, since all four tabs are siblings of one Tabs
  // component here.
  const [tab, setTab] = useState('summary');

  return (
    <PageContainer>
      <Tabs value={tab} onValueChange={setTab}>
        <PageHero>
          <PageHeader
            title="Finances"
            description="Suivez les paiements, dépenses et la rentabilité de l'agence."
          />
          <TabsList className="h-auto w-full justify-center gap-9 rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger value="summary" className={TAB_TRIGGER_CLASSES}>
              <span className={TAB_ICON_CLASSES}>
                <LayoutDashboard className="h-4 w-4" />
              </span>
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="payments" className={TAB_TRIGGER_CLASSES}>
              <span className={TAB_ICON_CLASSES}>
                <Wallet className="h-4 w-4" />
              </span>
              Paiements
            </TabsTrigger>
            <TabsTrigger value="expenses" className={TAB_TRIGGER_CLASSES}>
              <span className={TAB_ICON_CLASSES}>
                <Receipt className="h-4 w-4" />
              </span>
              Dépenses
            </TabsTrigger>
            <TabsTrigger value="deposits" className={TAB_TRIGGER_CLASSES}>
              <span className={TAB_ICON_CLASSES}>
                <ShieldCheck className="h-4 w-4" />
              </span>
              Cautions
            </TabsTrigger>
          </TabsList>
        </PageHero>
        <TabsContent value="summary" className="mt-4">
          <FinanceSummaryTab onViewDeposits={() => setTab('deposits')} />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab />
        </TabsContent>
        <TabsContent value="deposits" className="mt-4">
          <DepositsTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

export default FinancesPage;
