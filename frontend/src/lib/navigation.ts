import type { LucideIcon } from 'lucide-react';
import { CarFront, ClipboardList, History, LayoutDashboard, ScrollText, Settings, UserCog, Users, Wallet } from 'lucide-react';
import { can, type Permission, type Role } from '@car-rental/shared';

export type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  // Purely a sidebar-rendering grouping — does not affect routing.
  group: string;
  // The permission the page needs; everyone sees it when omitted. Only hides
  // the link — the route and the API enforce the same rule themselves.
  permission?: Permission;
  // The opposite: shown only to those *without* this permission (an
  // employee's "Mon activité", where the director has the full journal).
  hiddenWith?: Permission;
};

export const navItems: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard, group: "Vue d'ensemble" },
  { label: 'Mon activité', path: '/activity', icon: History, group: "Vue d'ensemble", hiddenWith: 'audit.view' },
  { label: 'Gestion des voitures', path: '/cars', icon: CarFront, group: 'Gestion' },
  { label: 'Gestion des clients', path: '/clients', icon: Users, group: 'Gestion' },
  { label: 'Gestion des locations', path: '/rentals', icon: ClipboardList, group: 'Gestion' },
  { label: 'Finances', path: '/finances', icon: Wallet, group: 'Gestion' },
  { label: "Journal d'activité", path: '/activity', icon: ScrollText, group: 'Système', permission: 'audit.view' },
  { label: 'Équipe', path: '/team', icon: UserCog, group: 'Système', permission: 'team.manage' },
  { label: 'Paramètres', path: '/settings', icon: Settings, group: 'Système', permission: 'settings.update' },
];

// The links a given role may follow — the sidebar, the mobile menu and the
// Ctrl+K palette all list these.
export function navItemsFor(role: Role | undefined): NavItem[] {
  return navItems.filter(
    (item) =>
      (!item.permission || can(role, item.permission)) && !(item.hiddenWith && can(role, item.hiddenWith)),
  );
}
