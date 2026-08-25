import { Fragment } from 'react';
import { NavLink } from 'react-router-dom';

import { navItems } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

// Purely visual grouping (see navItems' `group` field) — renders items under
// their section label in the order groups first appear, no routing impact.
function groupItems() {
  const groups: { name: string; items: typeof navItems }[] = [];
  for (const item of navItems) {
    const group = groups.find((g) => g.name === item.group);
    if (group) group.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return groups;
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const groups = groupItems();

  return (
    <nav className="flex flex-col gap-4 px-3" aria-label="Navigation principale">
      {groups.map((group) => (
        <div key={group.name} className="flex flex-col gap-1">
          {!collapsed && (
            <span className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.name}
            </span>
          )}
          {group.items.map((item) => {
            const link = (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={onNavigate}
                aria-label={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
                    collapsed && 'justify-center px-2',
                    isActive
                      ? 'bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/25'
                      : collapsed
                        ? 'text-sidebar-foreground/90 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                  )
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );

            if (!collapsed) return <Fragment key={item.path}>{link}</Fragment>;

            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
