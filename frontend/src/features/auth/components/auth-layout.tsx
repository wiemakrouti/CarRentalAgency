import type { ReactNode } from 'react';
import { CarFront } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
}

// Shared chrome for every auth screen (login, register, forgot/reset
// password, verify email) — a floating rounded card in the middle of the
// page, split into a brand panel and the page's own form content, so
// navigating between these screens never breaks visual continuity.
// The brand panel uses the fixed primary-800/900 tokens (not the adaptive
// --primary token): those two steps of the scale aren't redefined in dark
// mode (see index.css), so the gradient already reads as a deep navy panel
// in both themes without extra dark-mode-specific styling. The corner
// facets use explicit light/dark steps of the same scale instead, since
// unlike --primary they don't adapt on their own.
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 sm:p-8">
      <svg
        aria-hidden="true"
        viewBox="0 0 420 420"
        className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] sm:-left-48 sm:-top-48 sm:h-[720px] sm:w-[720px] lg:-left-56 lg:-top-56 lg:h-[860px] lg:w-[860px]"
      >
        <polygon points="0,0 260,0 120,180" className="fill-primary-100 dark:fill-primary-800" />
        <polygon
          points="0,0 120,180 0,260"
          className="fill-primary-50 dark:fill-primary-700/60"
        />
        <polygon
          points="260,0 420,80 120,180"
          className="fill-primary-200 dark:fill-primary-600/60"
        />
      </svg>
      <svg
        aria-hidden="true"
        viewBox="0 0 420 420"
        className="pointer-events-none absolute -bottom-40 -right-40 h-[560px] w-[560px] sm:-bottom-48 sm:-right-48 sm:h-[720px] sm:w-[720px] lg:-bottom-56 lg:-right-56 lg:h-[860px] lg:w-[860px]"
      >
        <polygon points="420,420 160,420 300,240" className="fill-primary-100 dark:fill-primary-800" />
        <polygon
          points="420,420 300,240 420,160"
          className="fill-primary-50 dark:fill-primary-700/60"
        />
        <polygon
          points="160,420 0,340 300,240"
          className="fill-primary-200 dark:fill-primary-600/60"
        />
      </svg>

      <div className="relative flex w-full max-w-[740px] overflow-hidden rounded-[20px] border bg-card shadow-[0_32px_64px_-20px_rgba(19,23,34,0.35),0_12px_24px_-12px_rgba(19,23,34,0.18)]">
        <div
          className="hidden w-[280px] flex-shrink-0 flex-col justify-between border-r p-8 text-white lg:flex"
          style={{
            background: 'linear-gradient(160deg, hsl(var(--primary-800)), hsl(var(--primary-900)))',
            borderColor: 'hsl(var(--primary-900) / 0.4)',
          }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <CarFront className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight">
              Gérez votre flotte, une location à la fois.
            </h2>
            <p className="mt-2.5 text-xs text-primary-200">
              Tableau de bord multi-agences pensé pour les loueurs indépendants.
            </p>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center p-7 sm:p-9">{children}</div>
      </div>
    </div>
  );
}

export default AuthLayout;
