import { Wrench } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { EmptyState } from '@/components/common/empty-state';

export function MaintenancePage() {
  return (
    <PageContainer>
      <PageHero>
        <PageHeader
          title="Maintenance"
          description="Planifiez les entretiens et suivez les coûts de maintenance."
        />
      </PageHero>
      <EmptyState
        icon={Wrench}
        title="Module en cours de construction"
        description="Le module Maintenance sera disponible dans une prochaine phase."
      />
    </PageContainer>
  );
}
