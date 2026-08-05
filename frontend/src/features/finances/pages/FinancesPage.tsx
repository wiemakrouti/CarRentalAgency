import { Wallet } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export function FinancesPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Finances"
        description="Suivez les paiements, dépenses et la rentabilité de l'agence."
      />
      <EmptyState
        icon={Wallet}
        title="Module en cours de construction"
        description="Le module Finances sera disponible dans une prochaine phase."
      />
    </PageContainer>
  );
}
