import type { GameState } from '../state/types';
import { getExpansionDef, type ExpansionDef } from '../data/expansions';
import { unlockStatusForStage } from '../progression/unlocks';
import { trySpend } from '../economy/funds';
import { nowIso } from '../sim/clock';

/**
 * Land expansion purchases — pure and UI-free.
 * Strict order: UNLOCK (stage) → VALIDITY (known/owned) → FUNDS → PURCHASE.
 * Failed attempts never touch coins. Land itself creates no income,
 * upkeep, satisfaction or population — only buildings placed on it do.
 */

export type ExpansionError = 'UNKNOWN_ZONE' | 'ALREADY_OWNED' | 'LOCKED' | 'NO_CITY' | 'INSUFFICIENT_FUNDS';

export type ExpansionResult =
  | { ok: true; state: GameState; expansion: ExpansionDef; spent: number }
  | { ok: false; error: ExpansionError; needed?: number; have?: number };

export function canPurchaseExpansion(state: GameState, zoneId: string): ExpansionError | null {
  const def = getExpansionDef(zoneId);
  if (!def) return 'UNKNOWN_ZONE';
  if (state.map.unlockedExpansionIds.includes(zoneId)) return 'ALREADY_OWNED';
  if (!unlockStatusForStage({ stage: def.requiredStage }, state.progress.highestStageId).unlocked) {
    return 'LOCKED';
  }
  return null;
}

export function purchaseExpansion(state: GameState, zoneId: string): ExpansionResult {
  const problem = canPurchaseExpansion(state, zoneId);
  if (problem) return { ok: false, error: problem };
  if (!state.city) return { ok: false, error: 'NO_CITY' };

  const def = getExpansionDef(zoneId) as ExpansionDef;
  const spend = trySpend(state.city.coins, def.cost);
  if (!spend.ok) return { ok: false, error: 'INSUFFICIENT_FUNDS', needed: def.cost, have: state.city.coins };

  return {
    ok: true,
    spent: def.cost,
    expansion: def,
    state: {
      ...state,
      city: { ...state.city, coins: spend.remaining },
      map: { unlockedExpansionIds: [...state.map.unlockedExpansionIds, zoneId] },
      timestamps: { ...state.timestamps, updatedAt: nowIso(), saveRevision: state.timestamps.saveRevision + 1 }
    }
  };
}

export const EXPANSION_MESSAGES: Record<ExpansionError, string> = {
  UNKNOWN_ZONE: 'Unknown land',
  ALREADY_OWNED: 'Already part of your city',
  LOCKED: 'Reach a later stage first',
  NO_CITY: 'No city yet',
  INSUFFICIENT_FUNDS: 'Not enough funds for this land'
};
