import { Settings } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { PageHero } from '@/components/common/page-hero';
import { EmptyState } from '@/components/common/empty-state';

export function SettingsPage() {
  return (
    <PageContainer>
      <PageHero>
        <PageHeader
          title="Paramètres"
          description="Configurez le profil de l'agence, la devise et les paramètres du contrat."
        />
      </PageHero>
      <EmptyState
        icon={Settings}
        title="Module en cours de construction"
        description="Le module Paramètres sera disponible dans une prochaine phase."
      />
    </PageContainer>
  );
}
