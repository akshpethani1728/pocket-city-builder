import type { BuildingInstance, GameState } from '../game/state/types';
import { isValidBuildingInstance } from '../game/city/newCity';
import { getBuildingDef } from '../game/data/buildings';
import { NEW_CITY_GRACE_SEC } from '../game/data/needs';
import { START_STAGE_ID, getStageDef } from '../game/data/stages';
import { getExpansionDef } from '../game/data/expansions';
import { migrateBuildingsToFullMap } from '../game/map/expansion';
import { logger } from './logger';

/**
 * TEMPORARY local persistence for development/testing convenience.
 * - LocalStorage is NOT the permanent authority (cloud save replaces this).
 * - Only coins/buildings snapshots; no economy authority is granted by it.
 * - Version-guarded: unknown versions are discarded, never migrated blindly.
 */

const KEY = 'pocketopolis.save.v1';
const SAVE_VERSION = 1;

interface LocalSave {
  version: number;
  savedAt: string;
  state: GameState;
}

export function saveLocal(state: GameState): void {
  try {
    const savedAt = new Date().toISOString();
    // Stamp lastActiveAt on write: resume point for the future offline phase.
    const stamped: GameState = state.city
      ? { ...state, timestamps: { ...state.timestamps, lastActiveAt: savedAt } }
      : state;
    const payload: LocalSave = { version: SAVE_VERSION, savedAt, state: stamped };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    logger.warn('local save failed', e);
  }
}

function validCount(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

/**
 * Clamp any stored level into [1, maxLevel] (unknown defs: ≥1).
 * Missing/invalid levels become 1 — pre-upgrade saves keep working.
 */
export function normalizeBuildingLevel(b: BuildingInstance): BuildingInstance {
  if (typeof b !== 'object' || b === null) return b;
  const def = typeof b.type === 'string' ? getBuildingDef(b.type) : undefined;
  const max = def ? def.maxLevel : 99;
  let level = typeof b.level === 'number' && Number.isFinite(b.level) ? Math.floor(b.level) : 1;
  if (level < 1) level = 1;
  if (level > max) level = max;
  return level === b.level ? b : { ...b, level };
}

export function loadLocal(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalSave>;
    if (parsed.version !== SAVE_VERSION || typeof parsed.state !== 'object' || parsed.state === null) {
      return null;
    }
    const s = parsed.state as GameState;
    if (s.version !== 1 || !s.city || !Array.isArray(s.buildings)) return null;
    if (typeof s.city.coins !== 'number' || !Number.isFinite(s.city.coins) || s.city.coins < 0) return null;
    // Normalize building levels (pre-level saves, floats, out-of-range):
    // keep the building, clamp to a valid level — never drop player assets.
    s.buildings = s.buildings.map((b) => normalizeBuildingLevel(b));
    if (!s.buildings.every(isValidBuildingInstance)) return null;
    // Normalize older saves and tolerate hand-edited values.
    s.city.population = validCount(s.city.population) ? Math.floor(s.city.population) : 0;
    s.city.housingCapacity = validCount(s.city.housingCapacity) ? Math.floor(s.city.housingCapacity) : 0;
    if (!validCount(s.city.populationProgress)) s.city.populationProgress = 0;
    // Pre-grace saves belong to established cities: full rules immediately.
    if (!validCount(s.city.ageSec)) s.city.ageSec = NEW_CITY_GRACE_SEC;
    const sat = (s.city as { satisfaction?: unknown }).satisfaction;
    if (typeof sat !== 'number' || !Number.isFinite(sat)) s.city.satisfaction = 0;
    else s.city.satisfaction = Math.min(1, Math.max(0, sat));
    // Pre-progression saves start at Settlement; unknown ids reset (safe).
    const hid = (s.progress as { highestStageId?: unknown } | undefined)?.highestStageId;
    if (!s.progress || typeof hid !== 'string' || !getStageDef(hid)) {
      s.progress = { highestStageId: START_STAGE_ID };
    }
    // Pre-tech saves have no researched tech; validate entries are strings.
    if (!s.technologies || !Array.isArray(s.technologies.unlocked)) {
      s.technologies = { unlocked: [] };
    } else {
      s.technologies = { unlocked: s.technologies.unlocked.filter((t): t is string => typeof t === 'string') };
    }
    // Pre-expansion saves: shift origin-based buildings into the full grid
    // (core moves to cols/rows 6..17) and start with no purchased land.
    // New saves already carry `map` and keep coordinates untouched.
    if (!s.map || !Array.isArray(s.map.unlockedExpansionIds)) {
      s.buildings = migrateBuildingsToFullMap(s.buildings);
      s.map = { unlockedExpansionIds: [] };
    } else {
      s.map = {
        unlockedExpansionIds: s.map.unlockedExpansionIds.filter(
          (id): id is string => typeof id === 'string' && !!getExpansionDef(id)
        )
      };
    }
    return s;
  } catch (e) {
    logger.warn('local load failed', e);
    return null;
  }
}
