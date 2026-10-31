import { PageHero } from '@/components/common/page-hero';

import { QuickActionsBar } from './quick-actions-bar';

// The dashboard's own header — today's date, the page title, a one-line
// summary, and the quick-create shortcuts — on the same PageHero background
// as every other module's header. On a phone it shrinks to the date and the
// title, so the fleet shows on the first screen; the shortcuts are then in
// the bottom bar's "+".
export function DashboardHeader() {
  const today = new Date().toLocaleDateString('fr-TN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <PageHero>
      <header className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-1 sm:space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary-600 dark:text-primary">{today}</p>
          <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-[28px]">Tableau de bord</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">Vue d'ensemble de l'activité de l'agence.</p>
        </div>
        <div className="hidden sm:block">
          <QuickActionsBar />
        </div>
      </header>
    </PageHero>
  );
}
