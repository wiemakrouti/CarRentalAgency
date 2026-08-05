import { CarFront } from 'lucide-react';

import { PageContainer } from '@/components/common/page-container';
import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';

export function CarsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Gestion des voitures"
        description="Ajoutez, modifiez et suivez la disponibilité de votre flotte de véhicules."
      />
      <EmptyState
        icon={CarFront}
        title="Module en cours de construction"
        description="La gestion des voitures sera disponible dans une prochaine phase."
      />
    </PageContainer>
  );
}
