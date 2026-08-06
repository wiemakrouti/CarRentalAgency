const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
} as const;

// Parses the same "15m" / "7d" style strings used by JWT_*_EXPIRES_IN into a
// millisecond count, so a plain Date (RefreshToken.expiresAt) can be computed
// without duplicating the expiry value as a raw number in .env.
export function parseDurationMs(duration: string): number {
  const match = /^(\d+)(s|m|h|d|w)$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration format: "${duration}" (expected e.g. "15m", "7d")`);
  }
  const amount = Number(match[1]);
  const unit = match[2]! as keyof typeof UNIT_MS;
  return amount * UNIT_MS[unit];
}
