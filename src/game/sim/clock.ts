/**
 * Time helpers. Phase 1 only.
 * IMPORTANT: device clock is NOT authoritative for payouts.
 * Server time (Supabase now()) becomes the source of truth in the idle phase.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/** Seconds between two ISO timestamps; 0 if invalid. Pure + testable. */
export function secondsBetween(aIso: string | null, bIso: string | null): number {
  if (!aIso || !bIso) return 0;
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, (b - a) / 1000);
}
