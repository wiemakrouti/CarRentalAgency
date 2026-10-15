import { createBrowserRouter, type RouteObject } from 'react-router-dom';

import { AppShell } from '@/components/layout/app-shell';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { RequirePermission } from '@/components/layout/require-permission';
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
    path: '/register',
    lazy: async () => {
      const { RegisterPage } = await import('@/features/auth/pages/RegisterPage');
      return { Component: RegisterPage };
    },
  },
  {
    path: '/forgot-password',
    lazy: async () => {
      const { ForgotPasswordPage } = await import('@/features/auth/pages/ForgotPasswordPage');
      return { Component: ForgotPasswordPage };
    },
  },
  {
    path: '/reset-password',
    lazy: async () => {
      const { ResetPasswordPage } = await import('@/features/auth/pages/ResetPasswordPage');
      return { Component: ResetPasswordPage };
    },
  },
  {
    path: '/verify-email',
    lazy: async () => {
      const { VerifyEmailPage } = await import('@/features/auth/pages/VerifyEmailPage');
      return { Component: VerifyEmailPage };
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
          {
            path: 'settings',
            handle: { breadcrumb: 'Paramètres' },
            element: (
              <RequirePermission permission="settings.update">
                <SettingsPage />
              </RequirePermission>
            ),
          },
          {
            path: 'activity',
            // The director's full journal; an employee's own actions only
            // ("Mon activité") — scoped by the API itself.
            handle: { breadcrumb: "Journal d'activité", employeeBreadcrumb: 'Mon activité' },
            lazy: async () => {
              const { ActivityPage } = await import('@/features/activity/pages/ActivityPage');
              return { Component: ActivityPage };
            },
          },
          {
            path: 'team',
            handle: { breadcrumb: 'Équipe' },
            lazy: async () => {
              const { TeamPage } = await import('@/features/team/pages/TeamPage');
              return {
                Component: () => (
                  <RequirePermission permission="team.manage">
                    <TeamPage />
                  </RequirePermission>
                ),
              };
            },
          },
          {
            path: 'profile',
            handle: { breadcrumb: 'Profil' },
            lazy: async () => {
              const { ProfilePage } = await import('@/features/profile/pages/ProfilePage');
              return { Component: ProfilePage };
            },
          },
        ],
      },
    ],
  },
  ...devRoutes,
]);
