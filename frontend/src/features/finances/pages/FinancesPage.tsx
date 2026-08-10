import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { FinanceSummaryTab } from '../components/finance-summary-tab';
import { PaymentsTab } from '../components/payments-tab';
import { ExpensesTab } from '../components/expenses-tab';

export function FinancesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Finances"
        description="Suivez les paiements, dépenses et la rentabilité de l'agence."
      />

      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Résumé</TabsTrigger>
          <TabsTrigger value="payments">Paiements</TabsTrigger>
          <TabsTrigger value="expenses">Dépenses</TabsTrigger>
        </TabsList>
        <TabsContent value="summary" className="mt-4">
          <FinanceSummaryTab />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

export default FinancesPage;
