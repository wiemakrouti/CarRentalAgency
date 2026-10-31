import { useSyncExternalStore } from 'react';

// Whether a CSS media query matches right now, kept in sync as it changes —
// for the few places that need a different component on a phone, not just
// different classes (e.g. a bottom sheet instead of a dropdown).
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
