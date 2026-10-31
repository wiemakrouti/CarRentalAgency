import { Clock, ShieldCheck } from 'lucide-react';

import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format-relative-time';

import type { TeamMember } from '../api/team.api';
import { memberState, type MemberState } from '../lib/member-state';
import { StatusBadge } from './team-member-status';
import { TeamMemberActions } from './team-member-actions';

const STATE_ORDER: Record<MemberState, number> = { active: 0, pending: 1, off: 2 };

const STATE_DOT: Record<MemberState, string> = {
  active: 'bg-success',
  pending: 'bg-warning',
  off: 'bg-muted-foreground/50',
};

function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

function Avatar({ member, size = 'md' }: { member: TeamMember; size?: 'md' | 'lg' }) {
  const state = memberState(member);
  return (
    <span className="relative shrink-0">
      <span
        className={cn(
          'flex items-center justify-center rounded-full font-bold',
          size === 'lg' ? 'h-12 w-12 text-base' : 'h-11 w-11 text-sm',
          state === 'off'
            ? 'bg-muted text-muted-foreground'
            : 'bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground',
        )}
      >
        {initials(member.fullName)}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-card',
          STATE_DOT[state],
        )}
      />
    </span>
  );
}

function lastSeen(member: TeamMember): string {
  return member.lastLoginAt ? `Connecté ${formatRelativeTime(member.lastLoginAt)}` : 'Jamais connecté';
}

type TeamMobileListProps = {
  members: TeamMember[];
  onEdit: (member: TeamMember) => void;
  onResetPassword: (member: TeamMember) => void;
  onDeactivate: (member: TeamMember) => void;
  onReactivate: (member: TeamMember) => void;
};

// The Team page on a phone: the director on their own, then one card per
// employee — still-active ones
// first, deactivated ones last and dimmed.
export function TeamMobileList({ members, ...actions }: TeamMobileListProps) {
  const directors = members.filter((m) => m.role !== 'EMPLOYEE');
  const employees = members
    .filter((m) => m.role === 'EMPLOYEE')
    .sort((a, b) => STATE_ORDER[memberState(a)] - STATE_ORDER[memberState(b)]);

  return (
    <div className="space-y-5 sm:hidden">
      {directors.map((director) => (
        <section key={director.id} className="space-y-2">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Direction
          </h2>
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-card p-4 shadow-xs">
            <Avatar member={director} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{director.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{director.email}</p>
            </div>
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
              <ShieldCheck className="h-3 w-3" />
              Directeur
            </span>
          </div>
        </section>
      ))}

      {employees.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Employés
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums">{employees.length}</span>
          </h2>
          <div className="space-y-2.5">
            {employees.map((member) => (
              <article
                key={member.id}
                className={cn(
                  'overflow-hidden rounded-2xl border border-border bg-card shadow-xs',
                  member.deactivatedAt && 'opacity-70',
                )}
              >
                <div className="flex items-center gap-3 p-4 pb-3 pr-2">
                  <Avatar member={member} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{member.fullName}</p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <TeamMemberActions member={member} {...actions} className="h-10 w-10 self-start" />
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-2.5">
                  <StatusBadge member={member} />
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{lastSeen(member)}</span>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
