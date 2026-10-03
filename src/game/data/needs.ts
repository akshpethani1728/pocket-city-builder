/**
 * Citizen-needs tuning — Phase 6.
 * Thresholds and rates for the satisfaction → growth/decline pipeline.
 * All values live here; sim and UI only read them.
 */

/** Satisfaction bands (0..1): full growth / slow growth / stall / decline. */
export const SAT_FULL = 0.8;
export const SAT_SLOW = 0.5;
export const SAT_STALL = 0.25;

/** Slow-band growth multiplier (fraction of MOVE_IN_PER_SEC). */
export const SLOW_GROWTH_FACTOR = 0.5;

/** Citizens leaving per second at critical satisfaction (slower than growth). */
export const MOVE_OUT_PER_SEC = 1 / 30;

/**
 * New-settlement grace (seconds of city age): decline is suppressed so
 * founding pioneers can't die before the player can build services.
 * Growth still obeys satisfaction + housing during grace.
 */
export const NEW_CITY_GRACE_SEC = 600;
