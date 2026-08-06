import { lazy, Suspense } from 'react';

// Same dev-only exclusion pattern as the /design-system route: the dynamic
// import is only ever reached when import.meta.env.DEV is true, so Vite
// replaces the condition with a literal `false` in production builds and
// drops this (and the whole devtools package) from the bundle entirely.
const LazyDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : null;

export function QueryDevtools() {
  if (!LazyDevtools) return null;
  return (
    <Suspense fallback={null}>
      <LazyDevtools initialIsOpen={false} />
    </Suspense>
  );
}
