import type { BuildingDef } from '../config/types';
import type { BuildingInstance, GameState } from '../state/types';
import { getBuildingDef } from '../data/buildings';
import { techModifiersFor } from '../progression/technology';
import { trySpend } from '../economy/funds';
import { sanitizeLevel } from './stats';
import { nowIso } from '../sim/clock';

/**
 * Building upgrades — pure and UI-free.
 * Cost formula (generic, uses the existing costGrowth field):
 *   upgradeCost = round(baseCost × costGrowth^currentLevel × (1 − discount))
 * E.g. $500 base at 1.15: L1→2 = $575, L2→3 = $661 (full price).
 * Pays through the funds authority; never touches coins directly.
 * Already-built instances stay upgradeable forever (locks gate only
 * new construction, never existing buildings).
 */

export type UpgradeError =
  | 'NOT_FOUND'
  | 'UNKNOWN_BUILDING'
  | 'INVALID_LEVEL'
  | 'MAX_LEVEL'
  | 'NO_CITY'
  | 'INSUFFICIENT_FUNDS';

export type UpgradeResult =
  | { ok: true; state: GameState; building: BuildingInstance; spent: number; toLevel: number }
  | { ok: false; error: UpgradeError; needed?: number; have?: number };

/** Upgrade price from `level` → `level + 1` (discount 0 = full price), or null when not upgradeable. */
export function upgradeCostFor(def: BuildingDef, level: number, costDiscount = 0): number | null {
  if (!Number.isInteger(level) || level < 1 || level >= def.maxLevel) return null;
  if (!Number.isFinite(def.baseCost.coins) || !Number.isFinite(def.costGrowth) || def.costGrowth <= 0) {
    return null;
  }
  const d = Number.isFinite(costDiscount) ? Math.min(0.9, Math.max(0, costDiscount)) : 0;
  return Math.max(0, Math.round(def.baseCost.coins * Math.pow(def.costGrowth, level) * (1 - d)));
}

export function canUpgrade(state: GameState, buildingId: string): UpgradeError | null {
  const b = state.buildings.find((x) => x.id === buildingId);
  if (!b) return 'NOT_FOUND';
  const def = getBuildingDef(b.type);
  if (!def) return 'UNKNOWN_BUILDING';
  if (!Number.isInteger(b.level)) return 'INVALID_LEVEL';
  if (b.level >= def.maxLevel) return 'MAX_LEVEL';
  if (b.level < 1) return 'INVALID_LEVEL';
  return null;
}

export function upgradeBuilding(state: GameState, buildingId: string): UpgradeResult {
  const problem = canUpgrade(state, buildingId);
  if (problem) return { ok: false, error: problem };
  if (!state.city) return { ok: false, error: 'NO_CITY' };

  const b = state.buildings.find((x) => x.id === buildingId) as BuildingInstance;
  const def = getBuildingDef(b.type) as BuildingDef;
  const cost = upgradeCostFor(def, b.level, techModifiersFor(state.technologies.unlocked).costDiscount);
  if (cost === null) return { ok: false, error: 'INVALID_LEVEL' };

  const spend = trySpend(state.city.coins, cost);
  if (!spend.ok) return { ok: false, error: 'INSUFFICIENT_FUNDS', needed: cost, have: state.city.coins };

  const toLevel = sanitizeLevel(b.level) + 1;
  const upgraded: BuildingInstance = { ...b, level: toLevel };
  return {
    ok: true,
    spent: cost,
    building: upgraded,
    toLevel,
    state: {
      ...state,
      city: { ...state.city, coins: spend.remaining },
      buildings: state.buildings.map((x) => (x.id === buildingId ? upgraded : x)),
      timestamps: { ...state.timestamps, updatedAt: nowIso(), saveRevision: state.timestamps.saveRevision + 1 }
    }
  };
}

export const UPGRADE_MESSAGES: Record<UpgradeError, string> = {
  NOT_FOUND: 'Building not found',
  UNKNOWN_BUILDING: 'Unknown building',
  INVALID_LEVEL: 'Invalid building level',
  MAX_LEVEL: 'MAX LEVEL',
  NO_CITY: 'No city yet',
  INSUFFICIENT_FUNDS: 'Not enough funds for upgrade'
};
