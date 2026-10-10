import { PageHero } from '@/components/common/page-hero';

import { QuickActionsBar } from './quick-actions-bar';

// The dashboard's own header — today's date, the page title, a one-line
// summary, and the quick-create shortcuts — on the same PageHero background
// as every other module's header.
export function DashboardHeader() {
  const today = new Date().toLocaleDateString('fr-TN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <PageHero>
      <header className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary-600 dark:text-primary">{today}</p>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground">Vue d'ensemble de l'activité de l'agence.</p>
        </div>
        <QuickActionsBar />
      </header>
    </PageHero>
  );
}
