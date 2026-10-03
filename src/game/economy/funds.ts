/**
 * Pure funds helpers — the ONLY place balances may change.
 * Rule: UI → economy functions → game state. Nothing else (UI, renderer,
 * future network code) may add to or subtract from coins directly.
 * Spending arrived in Phase 3; legitimate income arrives in Phase 5.
 */

export type SpendResult = { ok: true; remaining: number } | { ok: false; needed: number; have: number };

export function canAfford(coins: number, cost: number): boolean {
  return Number.isFinite(coins) && Number.isFinite(cost) && cost >= 0 && coins >= cost;
}

/** Never lets a balance go negative — returns the result, no exceptions. */
export function trySpend(coins: number, cost: number): SpendResult {
  if (!Number.isFinite(coins) || !Number.isFinite(cost) || cost < 0) {
    return { ok: false, needed: cost, have: coins };
  }
  if (coins < cost) return { ok: false, needed: cost, have: coins };
  return { ok: true, remaining: coins - cost };
}

/**
 * Add legitimate income (taxes, business revenue). Ignores invalid or
 * negative amounts — income can never corrupt a balance into NaN.
 * Fractional coins are intentional: the balance IS the accumulator.
 */
export function creditFunds(coins: number, amount: number): number {
  const base = Number.isFinite(coins) ? coins : 0;
  if (!Number.isFinite(amount) || amount <= 0) return base;
  return base + amount;
}

export interface ChargeResult {
  remaining: number;
  charged: number;
  unpaid: number;
}

/**
 * Recurring charges (maintenance). Unlike trySpend, this is partial:
 * it takes what's available down to exactly $0 and reports the rest as
 * unpaid. No debt, no negatives — the caller decides what unpaid means
 * (this phase: services keep running; shutdown arrives later if needed).
 */
export function chargeUpTo(coins: number, amount: number): ChargeResult {
  const base = Number.isFinite(coins) ? Math.max(0, coins) : 0;
  if (!Number.isFinite(amount) || amount <= 0) return { remaining: base, charged: 0, unpaid: 0 };
  const charged = Math.min(base, amount);
  return { remaining: base - charged, charged, unpaid: amount - charged };
}
