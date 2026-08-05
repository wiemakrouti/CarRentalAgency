import { BarChart3 } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export function ReportsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Rapports"
        description="Consultez des rapports détaillés sur l'activité de l'agence."
      />
      <EmptyState
        icon={BarChart3}
        title="Module en cours de construction"
        description="Le module Rapports sera disponible dans une prochaine phase."
      />
    </PageContainer>
  );
}
