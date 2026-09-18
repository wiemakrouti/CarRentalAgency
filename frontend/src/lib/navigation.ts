import type { LucideIcon } from 'lucide-react';
import { CarFront, ClipboardList, LayoutDashboard, Settings, Users, Wallet } from 'lucide-react';

export type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  // Purely a sidebar-rendering grouping — does not affect routing.
  group: string;
};

export const navItems: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard, group: "Vue d'ensemble" },
  { label: 'Gestion des voitures', path: '/cars', icon: CarFront, group: 'Gestion' },
  { label: 'Gestion des clients', path: '/clients', icon: Users, group: 'Gestion' },
  { label: 'Gestion des locations', path: '/rentals', icon: ClipboardList, group: 'Gestion' },
  { label: 'Finances', path: '/finances', icon: Wallet, group: 'Gestion' },
  { label: 'Paramètres', path: '/settings', icon: Settings, group: 'Système' },
];
