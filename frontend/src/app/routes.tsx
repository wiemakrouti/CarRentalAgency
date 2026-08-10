import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { MaintenancePage } from '@/features/maintenance/pages/MaintenancePage';
import { ReportsPage } from '@/features/reports/pages/ReportsPage';
import { SettingsPage } from '@/features/settings/pages/SettingsPage';

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/design-system',
        lazy: async () => {
          const { DesignSystemPage } = await import('@/dev/design-system/DesignSystemPage');
          return { Component: DesignSystemPage };
        },
      },
    ]
  : [];

export const router = createBrowserRouter([
  {
    path: '/login',
    lazy: async () => {
      const { LoginPage } = await import('@/features/auth/pages/LoginPage');
      return { Component: LoginPage };
    },
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          {
            index: true,
            handle: { breadcrumb: 'Tableau de bord' },
            lazy: async () => {
              const { DashboardPage } = await import('@/features/dashboard/pages/DashboardPage');
              return { Component: DashboardPage };
            },
          },
          {
            path: 'cars',
            handle: { breadcrumb: 'Gestion des voitures' },
            lazy: async () => {
              const { CarsPage } = await import('@/features/cars/pages/CarsPage');
              return { Component: CarsPage };
            },
          },
          {
            path: 'clients',
            handle: { breadcrumb: 'Gestion des clients' },
            lazy: async () => {
              const { ClientsPage } = await import('@/features/clients/pages/ClientsPage');
              return { Component: ClientsPage };
            },
          },
          {
            path: 'rentals',
            handle: { breadcrumb: 'Gestion des locations' },
            lazy: async () => {
              const { RentalsPage } = await import('@/features/rentals/pages/RentalsPage');
              return { Component: RentalsPage };
            },
          },
          {
            path: 'finances',
            handle: { breadcrumb: 'Finances' },
            lazy: async () => {
              const { FinancesPage } = await import('@/features/finances/pages/FinancesPage');
              return { Component: FinancesPage };
            },
          },
          { path: 'maintenance', handle: { breadcrumb: 'Maintenance' }, element: <MaintenancePage /> },
          { path: 'reports', handle: { breadcrumb: 'Rapports' }, element: <ReportsPage /> },
          { path: 'settings', handle: { breadcrumb: 'Paramètres' }, element: <SettingsPage /> },
        ],
      },
    ],
  },
  ...devRoutes,
]);
