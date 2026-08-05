import { Wrench } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export function MaintenancePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Maintenance"
        description="Planifiez les entretiens et suivez les coûts de maintenance."
      />
      <EmptyState
        icon={Wrench}
        title="Module en cours de construction"
        description="Le module Maintenance sera disponible dans une prochaine phase."
      />
    </PageContainer>
  );
}
