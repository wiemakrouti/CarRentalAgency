import { CarFront, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SidebarNav } from '@/components/layout/sidebar-nav';

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      aria-label="Barre latérale"
      className={cn(
        'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center gap-2 border-b border-sidebar-border px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <CarFront className="h-4 w-4" />
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-sidebar-foreground">
            Agence de Location
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNav collapsed={collapsed} />
      </div>

      <div className="border-t border-sidebar-border p-3">
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
