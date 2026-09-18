// Deliberately not a dependency (ua-parser-js et al.) — the session list only
// needs a friendly one-line label ("Chrome sur Windows"), not device/engine/
// CPU detail. Order matters: Edge and Opera both include "Chrome" in their
// UA string, and Chrome includes "Safari", so the more specific match has to
// run first.
export function parseUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Appareil inconnu';

  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null;

  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : 'Navigateur';

  return os ? `${browser} sur ${os}` : browser;
}

export function isMobileUserAgent(userAgent: string | null): boolean {
  return userAgent ? /Android|iPhone|iPad/.test(userAgent) : false;
}
