/**
 * Economy tuning values — Phase 3 foundation, Phase 5 income.
 * Single source of truth for money numbers. UI and logic must import from
 * here, never hardcode amounts. Upkeep arrives in a later phase.
 */

/** Funds every new city starts with. */
export const STARTING_COINS = 10_000;

/** Display symbol for the main currency. */
export const COIN_SYMBOL = '$';

/**
 * Tax income per citizen per minute. $3/min means a 20-citizen town earns
 * ~$1/sec — visibly alive, and a $500 House pays back in ~8 min at that
 * size. Retune here (never in sim/UI code) as the game grows.
 */
export const TAX_PER_CITIZEN_PER_MIN = 3;

export const TAX_PER_CITIZEN_PER_SEC = TAX_PER_CITIZEN_PER_MIN / 60;

export function formatCoins(n: number): string {
  return `${COIN_SYMBOL}${Math.floor(n).toLocaleString('en-US')}`;
}
