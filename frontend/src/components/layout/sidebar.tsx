import { CarFront, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { SidebarNav } from '@/components/layout/sidebar-nav';

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user } = useAuth();
  const initial = user?.fullName?.trim()?.charAt(0)?.toUpperCase() || 'A';

  return (
    <aside
      aria-label="Barre latérale"
      className={cn(
        'relative hidden shrink-0 flex-col overflow-hidden rounded-3xl border border-sidebar-border bg-sidebar shadow-elevation transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'relative flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-700 text-primary-foreground shadow-md shadow-primary/30">
          <CarFront className="h-[18px] w-[18px]" />
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-bold tracking-tight text-sidebar-foreground">
            Agence de Location
          </span>
        )}
      </div>

      <div className="relative flex-1 overflow-y-auto py-4">
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className="relative border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center gap-2.5 rounded-xl px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-700 text-xs font-bold text-primary-foreground shadow-sm">
              {initial}
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-xs font-semibold text-sidebar-foreground">
                {user?.fullName ?? 'Administrateur'}
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/50">Compte unique</span>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-label={collapsed ? 'Agrandir la barre latérale' : 'Réduire la barre latérale'}
          className={cn(
            'w-full text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
            collapsed ? 'justify-center px-0' : 'justify-start',
          )}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {!collapsed && 'Réduire'}
        </Button>
      </div>
    </aside>
  );
}
