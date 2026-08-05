import { Settings } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Paramètres"
        description="Configurez le profil de l'agence, la devise et les paramètres du contrat."
      />
      <EmptyState
        icon={Settings}
        title="Module en cours de construction"
        description="Le module Paramètres sera disponible dans une prochaine phase."
      />
    </PageContainer>
  );
}
