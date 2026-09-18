import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

// Mirrors KpiCard's `variant="satin"` treatment (components/common/kpi-card.tsx)
// — the soft primary-tinted diagonal gradient + sheen already approved for
// the Dashboard's top KPI row — reused here so the Profil/Compte pages
// share that look instead of inventing a separate style. The primary-100
// stop needs its own dark: fallback onto bare --primary because the
// numbered primary-N scale has no dark-mode values (see kpi-card.tsx for
// the same note).
const PANEL_CLASS =
  'relative overflow-hidden shadow-xs bg-[linear-gradient(160deg,hsl(var(--primary-100)),hsl(var(--card))_75%)] dark:bg-[linear-gradient(160deg,hsl(var(--primary)/0.18),hsl(var(--card))_75%)]';

function PanelSheen() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,transparent_40%,rgba(255,255,255,.55)_50%,transparent_60%)] dark:bg-[linear-gradient(125deg,transparent_40%,rgba(255,255,255,.06)_50%,transparent_60%)]"
    />
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Card className={cn(PANEL_CLASS, className)}>
      <PanelSheen />
      <div className="relative">{children}</div>
    </Card>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-base font-bold text-foreground">{children}</h2>;
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <Label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}
