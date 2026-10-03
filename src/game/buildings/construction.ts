import type { MapDef, TileCoord } from '../map/types';
import { isBuildableTile, isInsideMap } from '../map/types';
import type { BuildingDef } from '../config/types';
import type { BuildingInstance, GameState } from '../state/types';
import { getBuildingDef } from '../data/buildings';
import { unlockStatusForStage } from '../progression/unlocks';
import { techModifiersFor } from '../progression/technology';
import { trySpend } from '../economy/funds';
import { nowIso } from '../sim/clock';

/**
 * Construction engine — pure, UI-free, renderer-free.
 * Strict order: UNLOCK → PLACEMENT → FUNDS → CREATE. Funds are never
 * touched unless the building is unlocked and placement is fully legal,
 * and never go negative (see funds.ts). Urban Planning tech discounts
 * construction via the state's researched ids (0 when none).
 */

export type PlacementError = 'OUTSIDE_MAP' | 'NOT_BUILDABLE' | 'OCCUPIED';
export type ConstructError = PlacementError | 'UNKNOWN_BUILDING' | 'LOCKED' | 'NO_CITY' | 'INSUFFICIENT_FUNDS';

export type ConstructResult =
  | { ok: true; state: GameState; building: BuildingInstance; spent: number }
  | { ok: false; error: ConstructError; needed?: number; have?: number };

export function isTileOccupied(state: GameState, tile: TileCoord): boolean {
  return state.buildings.some((b) => b.x === tile.col && b.y === tile.row);
}

export function validatePlacement(state: GameState, map: MapDef, tile: TileCoord): PlacementError | null {
  if (!isInsideMap(map, tile.col, tile.row)) return 'OUTSIDE_MAP';
  if (!isBuildableTile(map, tile.col, tile.row)) return 'NOT_BUILDABLE';
  if (isTileOccupied(state, tile)) return 'OCCUPIED';
  return null;
}

export function constructBuilding(state: GameState, map: MapDef, defId: string, tile: TileCoord): ConstructResult {
  const def = getBuildingDef(defId);
  if (!def) return { ok: false, error: 'UNKNOWN_BUILDING' };
  if (!state.city) return { ok: false, error: 'NO_CITY' };

  const lock = unlockStatusForStage(def.unlockRequirement, state.progress.highestStageId);
  if (!lock.unlocked) return { ok: false, error: 'LOCKED' };

  const placementError = validatePlacement(state, map, tile);
  if (placementError) return { ok: false, error: placementError };

  const cost = constructionCostFor(def, techModifiersFor(state.technologies.unlocked).costDiscount);
  const spend = trySpend(state.city.coins, cost);
  if (!spend.ok) return { ok: false, error: 'INSUFFICIENT_FUNDS', needed: cost, have: state.city.coins };

  const building: BuildingInstance = {
    id: `${def.id}@${tile.col},${tile.row}`,
    type: def.id,
    x: tile.col, // grid coords (renderer converts to screen)
    y: tile.row,
    level: 1
  };

  return {
    ok: true,
    spent: cost,
    building,
    state: {
      ...state,
      city: { ...state.city, coins: spend.remaining },
      buildings: [...state.buildings, building],
      timestamps: { ...state.timestamps, updatedAt: nowIso(), saveRevision: state.timestamps.saveRevision + 1 }
    }
  };
}

export const CONSTRUCT_MESSAGES: Record<ConstructError, string> = {
  OUTSIDE_MAP: "Can't build outside the map",
  NOT_BUILDABLE: "Can't build on this terrain",
  OCCUPIED: 'Tile is occupied — pick an empty tile',
  UNKNOWN_BUILDING: 'Unknown building',
  LOCKED: 'Not unlocked yet — grow your city',
  NO_CITY: 'No city yet',
  INSUFFICIENT_FUNDS: 'Not enough funds'
};

/** Construction price with tech discount (0 = full price). Rounded. */
export function constructionCostFor(def: BuildingDef, costDiscount: number): number {
  const d = Number.isFinite(costDiscount) ? Math.min(0.9, Math.max(0, costDiscount)) : 0;
  return Math.max(0, Math.round(def.baseCost.coins * (1 - d)));
}
