import { Users } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export function ClientsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Gestion des clients"
        description="Gérez les profils, documents et statut de vos clients."
      />
      <EmptyState
        icon={Users}
        title="Module en cours de construction"
        description="La gestion des clients sera disponible dans une prochaine phase."
      />
    </PageContainer>
  );
}
