import { NavLink, useMatch } from 'react-router-dom';

import type { Role } from '@car-rental/shared';

import { navItemsFor, type NavItem } from '@/lib/navigation';
import { useAuth } from '@/providers/auth-context';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePendingApprovalsQuery } from '@/features/approvals/hooks/use-approvals';

type SidebarNavProps = {
  collapsed?: boolean;
  onNavigate?: () => void;
};

// Purely visual grouping (see navItems' `group` field) — renders items under
// their section label in the order groups first appear, no routing impact.
// Links the role may not follow are left out.
function groupItems(role: Role | undefined) {
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const item of navItemsFor(role)) {
    const group = groups.find((g) => g.name === item.group);
    if (group) group.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return groups;
}

type SidebarNavLinkProps = {
  item: NavItem;
  collapsed: boolean;
  onNavigate?: () => void;
  // A count shown on the icon — the requests waiting for the director, on
  // "Journal d'activité".
  badge?: number;
};

// Extracted so `isActive` can be resolved with `useMatch` — the same
// matching engine NavLink uses internally — instead of NavLink's own
// function-valued `className` prop. That function form breaks when the link
// is wrapped in <TooltipTrigger asChild> (collapsed sidebar only): Radix's
// Slot merges its own className with the child's by coercing both to
// strings, and a function coerces to its *source code text* rather than
// being invoked — so every collapsed icon silently lost its real Tailwind
// classes (active vs. inactive color) in favor of that stringified
// gibberish. Resolving isActive up front lets className stay a plain
// string, which Slot merges correctly either way.
function SidebarNavLink({ item, collapsed, onNavigate, badge = 0 }: SidebarNavLinkProps) {
  const isActive = !!useMatch({ path: item.path, end: item.path === '/' });

  const link = (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      onClick={onNavigate}
      aria-label={collapsed || badge > 0 ? `${item.label}${badge > 0 ? ` (${badge} à valider)` : ''}` : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        collapsed && 'justify-center px-2',
        isActive
          ? 'bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-md shadow-primary/25'
          : collapsed
            ? 'text-sidebar-foreground/90 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
      )}
    >
      <span className="relative shrink-0">
        <item.icon className="h-4 w-4" />
        {badge > 0 && (
          <span className="absolute -right-2 -top-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-[3px] text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-sidebar">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const { user } = useAuth();
  const groups = groupItems(user?.role);
  const { data: pending } = usePendingApprovalsQuery();
  const badges: Record<string, number> = { '/activity': pending?.length ?? 0 };

  return (
    <nav className="flex flex-col gap-4 px-3" aria-label="Navigation principale">
      {groups.map((group) => (
        <div key={group.name} className="flex flex-col gap-1">
          {!collapsed && (
            <span className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
              {group.name}
            </span>
          )}
          {group.items.map((item) => (
            <SidebarNavLink
              key={item.path}
              item={item}
              collapsed={collapsed}
              onNavigate={onNavigate}
              badge={badges[item.path]}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
