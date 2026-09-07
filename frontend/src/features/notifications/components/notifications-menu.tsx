import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CalendarClock,
  CarFront,
  CheckCircle2,
  Clock,
  ClipboardList,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LoadingState } from '@/components/common/loading-state';
import { ErrorState } from '@/components/common/error-state';
import { cn } from '@/lib/utils';
import { REFETCH_INTERVAL_MS, REMINDERS_WITHIN_DAYS, useRemindersQuery } from '../hooks/use-notifications';
import { getReminderLink } from '../lib/reminder-links';
import type { Reminder } from '../api/notifications.api';

// Same icon per module as the sidebar nav (lib/navigation.ts) — a
// notification about a car reads as "car" at a glance because it reuses the
// exact glyph the admin already associates with that module.
const ENTITY_ICON: Record<Reminder['entityType'], LucideIcon> = {
  Car: CarFront,
  Client: Users,
  Rental: ClipboardList,
  MaintenanceRecord: Wrench,
};

// Overdue is already flagged server-side (reminder.overdue). Today/upcoming
// is a further split of everything else, by UTC calendar day — matches
// car-alerts.ts/client-alerts.ts's own daysUntil so this never contradicts
// reminder.overdue for something due earlier the same UTC day. Rentals land
// here too now: RemindersService's own RENTAL_OVERDUE/RENTAL_PICKUP_OVERDUE
// queries (backend/src/services/reminders.service.ts) compare against the
// start of today, not the exact instant, so a rental due today falls
// through to this "today" bucket exactly like a Car/Client/Maintenance date
// due today does, instead of reading as already overdue before today is over.
type ReminderCategory = 'overdue' | 'today' | 'upcoming';

function getDaysUntil(dueDate: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = new Date(dueDate);
  const targetDay = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  return Math.round((targetDay - today) / msPerDay);
}

function categorize(reminder: Reminder): ReminderCategory {
  if (reminder.overdue) return 'overdue';
  return getDaysUntil(reminder.dueDate) <= 0 ? 'today' : 'upcoming';
}

const CATEGORY_STYLES: Record<
  ReminderCategory,
  { text: string; bg: string; ring: string; border: string }
> = {
  overdue: { text: 'text-destructive', bg: 'bg-destructive/10', ring: 'ring-destructive/20', border: 'border-destructive/25' },
  today: { text: 'text-warning', bg: 'bg-warning/10', ring: 'ring-warning/20', border: 'border-warning/25' },
  upcoming: { text: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20', border: 'border-primary/25' },
};

// A relative day count to scan quickly — the label itself already spells
// out the full date in French ("... le 30/08/2026"), this is the compact
// complement, same idea as the Cars/Clients expiry badges.
function formatDueIn(reminder: Reminder, category: ReminderCategory): string {
  const days = getDaysUntil(reminder.dueDate);
  if (category === 'overdue') {
    const daysLate = Math.abs(days);
    return daysLate === 0 ? "En retard depuis aujourd'hui" : `En retard de ${daysLate} j`;
  }
  if (category === 'today') return "Aujourd'hui";
  return days === 1 ? 'Demain' : `Dans ${days} j`;
}

function NotificationRow({ reminder }: { reminder: Reminder }) {
  const Icon = ENTITY_ICON[reminder.entityType];
  const category = categorize(reminder);
  const style = CATEGORY_STYLES[category];
  return (
    <DropdownMenuItem asChild className="group items-start gap-3 rounded-[14px] px-2 py-2.5 cursor-pointer">
      <Link to={getReminderLink(reminder)}>
        <div
          className={cn(
            'flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] ring-1',
            style.bg,
            style.text,
            style.ring,
          )}
        >
          <Icon className="h-[17px] w-[17px]" />
        </div>
        <div className="min-w-0 flex-1 whitespace-normal">
          <p className="text-[13.5px] leading-snug text-foreground">{reminder.label}</p>
          <p className={cn('mt-[3px] text-xs font-semibold', style.text)}>{formatDueIn(reminder, category)}</p>
        </div>
      </Link>
    </DropdownMenuItem>
  );
}

type TabKey = 'all' | ReminderCategory;

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'overdue', label: 'En retard' },
  { key: 'today', label: "Aujourd'hui" },
  { key: 'upcoming', label: 'À venir' },
];

export function NotificationsMenu() {
  const { data: reminders, isLoading, isError, refetch } = useRemindersQuery();
  const [tab, setTab] = useState<TabKey>('all');

  const count = reminders?.length ?? 0;
  const overdue = useMemo(() => reminders?.filter((r) => categorize(r) === 'overdue') ?? [], [reminders]);
  const today = useMemo(() => reminders?.filter((r) => categorize(r) === 'today') ?? [], [reminders]);
  const upcoming = useMemo(() => reminders?.filter((r) => categorize(r) === 'upcoming') ?? [], [reminders]);
  const hasOverdue = overdue.length > 0;

  const visible =
    tab === 'overdue' ? overdue : tab === 'today' ? today : tab === 'upcoming' ? upcoming : (reminders ?? []);

  return (
    <DropdownMenu onOpenChange={() => setTab('all')}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full bg-muted hover:bg-accent"
          aria-label={count > 0 ? `Notifications (${count})` : 'Notifications'}
        >
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-background px-1 text-[9.5px] font-bold',
                hasOverdue ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground',
              )}
            >
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[420px] overflow-hidden rounded-[20px] border-border p-0">
        <div className="relative flex items-center gap-3 px-[22px] pt-[22px]">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
            <Bell className="h-[18px] w-[18px] text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-tight text-foreground">Notifications</p>
            <p className="mt-px text-xs text-muted-foreground">
              Échéances des {REMINDERS_WITHIN_DAYS} prochains jours
            </p>
          </div>
        </div>

        {isLoading ? (
          // Without this, the dropdown briefly shows the "Tout est sous
          // contrôle" success state on every first open (reminders is still
          // undefined, so count === 0) before flipping to the real count —
          // a false all-clear that then immediately contradicts itself.
          <LoadingState message="Chargement des notifications..." className="min-h-0 py-11" />
        ) : isError ? (
          <ErrorState
            className="min-h-0 rounded-none border-0 bg-transparent px-8 py-11"
            description="Impossible de charger les notifications."
            onRetry={() => refetch()}
          />
        ) : count === 0 ? (
          <div className="relative flex flex-col items-center gap-3 px-8 py-11 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
            <p className="text-[15px] font-bold text-foreground">Tout est sous contrôle</p>
            <p className="text-xs text-muted-foreground">Aucune échéance à signaler pour le moment.</p>
          </div>
        ) : (
          <>
            {/* Hero stats — only the groups that actually have items, so one
                or two lone groups fill the row instead of leaving gaps. */}
            <div className="relative flex gap-2 px-[22px] pt-[18px]">
              {hasOverdue && (
                <div className="flex-1 rounded-[14px] border border-destructive/25 bg-destructive/10 px-3.5 py-3.5">
                  <div className="text-[24px] font-extrabold leading-none tabular-nums text-destructive">
                    {overdue.length}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-destructive">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    En retard
                  </div>
                </div>
              )}
              {today.length > 0 && (
                <div className="flex-1 rounded-[14px] border border-warning/25 bg-warning/10 px-3.5 py-3.5">
                  <div className="text-[24px] font-extrabold leading-none tabular-nums text-warning">
                    {today.length}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-warning">
                    <CalendarClock className="h-3 w-3 shrink-0" />
                    Aujourd'hui
                  </div>
                </div>
              )}
              {upcoming.length > 0 && (
                <div className="flex-1 rounded-[14px] border border-primary/25 bg-primary/10 px-3.5 py-3.5">
                  <div className="text-[24px] font-extrabold leading-none tabular-nums text-primary">
                    {upcoming.length}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                    <Clock className="h-3 w-3 shrink-0" />
                    À venir
                  </div>
                </div>
              )}
            </div>

            {/* Segmented filter */}
            <div className="relative mx-[22px] mt-4 flex items-center gap-1 rounded-[11px] border border-border bg-muted p-[3px]">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex-1 rounded-lg py-1.5 text-center text-[11.5px] font-semibold transition-colors',
                    tab === key
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="relative mt-1 max-h-[400px] overflow-y-auto p-3">
              {visible.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-muted-foreground">
                  Aucune échéance dans cette catégorie.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {visible.map((reminder) => (
                    <NotificationRow key={`${reminder.type}-${reminder.entityId}`} reminder={reminder} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="relative border-t border-border px-[22px] py-3 text-center">
          <span className="text-[11px] text-muted-foreground">
            Actualisé automatiquement toutes les {REFETCH_INTERVAL_MS / 60_000} minutes
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
