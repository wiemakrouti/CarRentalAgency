import { ClipboardList } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export function RentalsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Gestion des locations"
        description="Créez et suivez les contrats de location en cours et passés."
      />
      <EmptyState
        icon={ClipboardList}
        title="Module en cours de construction"
        description="La gestion des locations sera disponible dans une prochaine phase."
      />
    </PageContainer>
  );
}
