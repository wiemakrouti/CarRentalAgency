import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type GaugeTone = 'success' | 'primary' | 'destructive';

const RING_THICKNESS_PX = 7;

const TONE_COLOR: Record<GaugeTone, string> = {
  success: 'var(--success)',
  primary: 'var(--primary)',
  destructive: 'var(--destructive)',
};

// The whole card is tinted with its tone, so the two figures read as
// distinct at a glance (collected money in green, profit in blue).
const TONE_CARD: Record<GaugeTone, string> = {
  success: 'border-success/25 bg-success/[0.06]',
  primary: 'border-primary/20 bg-primary/[0.05]',
  destructive: 'border-destructive/25 bg-destructive/[0.06]',
};

const TONE_TEXT: Record<GaugeTone, string> = {
  success: 'text-green-700 dark:text-success',
  primary: 'text-primary-700 dark:text-primary',
  destructive: 'text-red-700 dark:text-destructive',
};

type GaugeCardProps = {
  label: string;
  value: string;
  // 0–100, or null when there is nothing to measure yet (shown as "—").
  percent: number | null;
  percentLabel: string;
  tone: GaugeTone;
  children?: ReactNode;
  className?: string;
};

// A dashboard figure with a ring gauge beside it: the ring says how healthy
// the figure is (share collected, profit margin), the text gives the amount.
// The ring is masked rather than drawn as a disc with a filled centre, so it
// sits on the card's own tint in both themes.
export function GaugeCard({ label, value, percent, percentLabel, tone, children, className }: GaugeCardProps) {
  const shown = percent === null ? null : Math.round(Math.min(Math.max(percent, 0), 100));
  const color = TONE_COLOR[tone];
  const track = `hsl(${color} / 0.15)`;

  return (
    <div className={cn('flex h-full items-center gap-5 rounded-xl border p-5', TONE_CARD[tone], className)}>
      <div
        role="img"
        aria-label={shown === null ? `${percentLabel} : non disponible` : `${shown} % ${percentLabel}`}
        className="relative flex h-24 w-24 shrink-0 flex-col items-center justify-center"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            background: shown === null ? track : `conic-gradient(hsl(${color}) 0 ${shown}%, ${track} ${shown}% 100%)`,
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${RING_THICKNESS_PX}px), #000 calc(100% - ${RING_THICKNESS_PX - 1}px))`,
            WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${RING_THICKNESS_PX}px), #000 calc(100% - ${RING_THICKNESS_PX - 1}px))`,
          }}
        />
        <span className="text-xl font-bold tabular-nums">{shown === null ? '—' : `${shown} %`}</span>
        <span className={cn('text-[10.5px] font-medium', TONE_TEXT[tone])}>{percentLabel}</span>
      </div>
      <div className="min-w-0 space-y-1">
        <p className={cn('text-sm font-semibold', TONE_TEXT[tone])}>{label}</p>
        <p className="truncate text-[26px] font-bold leading-tight tracking-tight tabular-nums">{value}</p>
        {children}
      </div>
    </div>
  );
}
