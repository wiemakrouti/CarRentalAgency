import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRemindersQuery } from '../hooks/use-notifications';
import { REMINDER_ENTITY_PATH } from '../lib/reminder-links';

export function NotificationsMenu() {
  const { data: reminders } = useRemindersQuery();
  const count = reminders?.length ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {count === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            Aucune notification pour le moment.
          </div>
        ) : (
          <div className="max-h-80 space-y-0.5 overflow-y-auto">
            {reminders!.map((reminder) => (
              <DropdownMenuItem key={`${reminder.type}-${reminder.entityId}`} asChild>
                <Link
                  to={REMINDER_ENTITY_PATH[reminder.entityType]}
                  className="flex items-start gap-2 whitespace-normal"
                >
                  <span
                    className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                      reminder.overdue ? 'bg-destructive' : 'bg-warning'
                    }`}
                  />
                  <span className="flex-1 text-sm leading-snug">{reminder.label}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
