import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, ChevronDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

import type { ActivityEntry } from '../api/activity.api';
import type { DescribedActivity, Tone } from '../lib/describe-activity';

const TONE_ICON: Record<Tone, string> = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-green-700 dark:text-success',
  warning: 'bg-warning/15 text-warning-foreground dark:text-warning',
  destructive: 'bg-destructive/15 text-red-700 dark:text-destructive',
};

// fr-TN defaults to a 12-hour clock ("09:07 PM"); the app shows 24-hour times.
function time(value: string): string {
  return new Date(value).toLocaleTimeString('fr-TN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

type ActivityRowProps = {
  entry: ActivityEntry;
  described: DescribedActivity;
  // Shown at the end of the line — the director's Valider/Refuser on a
  // request still waiting, or where a request stands.
  aside?: ReactNode;
};

// One journal line: who, what, when — with the before → after details of an
// edit one click away, and a link to the record when it still exists.
export function ActivityRow({ entry, described, aside }: ActivityRowProps) {
  const [open, setOpen] = useState(false);
  const Icon = described.icon;
  const actor = entry.actor;

  return (
    <li className="relative px-4 py-3 sm:px-5 sm:py-3.5 max-sm:before:absolute max-sm:before:inset-y-0 max-sm:before:left-8 max-sm:before:w-px max-sm:before:bg-border max-sm:first:before:top-5 max-sm:last:before:bottom-auto max-sm:last:before:h-5">
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
        {/* The card behind the tinted icon hides the timeline under it. */}
        <span className="relative mt-0.5 shrink-0 rounded-lg bg-card">
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg sm:h-9 sm:w-9', TONE_ICON[described.tone])}>
            <Icon className="h-4 w-4" />
          </span>
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm leading-snug">
              {actor ? (
                <span className="font-semibold">{actor.fullName}</span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold text-muted-foreground">
                  <Bot className="h-3.5 w-3.5" />
                  Automatique
                </span>
              )}{' '}
              {/* Left out on a phone, where it breaks up nearly every line —
                  the team is small enough to know who the director is. */}
              {actor && actor.role === 'ADMIN' && (
                <span className="max-sm:hidden">
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    Directeur
                  </Badge>{' '}
                </span>
              )}
              {described.text}
            </p>
            {/* On a phone the time sits top right, where a timeline reads it. */}
            <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground sm:hidden">
              {time(entry.createdAt)}
            </span>
          </div>
          {described.detail && <p className="text-xs text-muted-foreground">{described.detail}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="tabular-nums max-sm:hidden">{time(entry.createdAt)}</span>
            {described.changes.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                {open ? 'Masquer le détail' : `Voir le détail (${described.changes.length})`}
                <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
              </button>
            )}
            {described.link && (
              <Link to={described.link} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                Ouvrir
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          {open && (
            <dl className="mt-2 grid gap-x-4 gap-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-xs sm:grid-cols-[auto_1fr]">
              {described.changes.map((change) => (
                <div key={change.label} className="contents">
                  <dt className="font-medium text-muted-foreground">{change.label}</dt>
                  <dd className="min-w-0 break-words">
                    <span className="text-muted-foreground line-through">{change.before}</span>
                    <span className="mx-1.5 text-muted-foreground">→</span>
                    <span className="font-semibold">{change.after}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {aside && <div className="basis-full pl-11 sm:basis-auto sm:self-center sm:pl-0">{aside}</div>}
      </div>
    </li>
  );
}
