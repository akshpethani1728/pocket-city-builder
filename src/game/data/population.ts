/**
 * Population tuning values — Phase 4.
 * Single source of truth for growth pacing. UI and sim must import from
 * here, never hardcode rates. Satisfaction/needs/taxes arrive later.
 */

/** Founding citizens of a brand-new city (pre-housing pioneers). */
export const STARTING_POPULATION = 5;

/**
 * Citizens arriving per real second while free housing exists.
 * 1/15 ≈ one newcomer every 15s — slow enough to feel gradual,
 * fast enough that the first House (cap 4) visibly fills in ~1 minute.
 */
export const MOVE_IN_PER_SEC = 1 / 15;

/** Largest online dt the tick engine processes in one call (seconds). */
export const MAX_ONLINE_DT_SEC = 300;
