import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CarFront,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';

export type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

export const navItems: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: LayoutDashboard },
  { label: 'Gestion des voitures', path: '/cars', icon: CarFront },
  { label: 'Gestion des clients', path: '/clients', icon: Users },
  { label: 'Gestion des locations', path: '/rentals', icon: ClipboardList },
  { label: 'Finances', path: '/finances', icon: Wallet },
  { label: 'Maintenance', path: '/maintenance', icon: Wrench },
  { label: 'Rapports', path: '/reports', icon: BarChart3 },
  { label: 'Paramètres', path: '/settings', icon: Settings },
];
