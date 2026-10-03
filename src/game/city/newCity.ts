import type { BuildingInstance, CityState } from '../state/types';
import { createInitialState, type GameState } from '../state/types';
import { STARTING_COINS } from '../data/economy';
import { STARTING_POPULATION } from '../data/population';
import { nowIso } from '../sim/clock';

/**
 * Starter city: a funded settlement with a handful of founding pioneers
 * and no housing yet — the first residential build visibly fills up.
 * (Pioneers may transiently exceed capacity; growth never adds beyond cap,
 * and the future decline system reconciles over-cap population.)
 */
export function createStarterCity(): CityState {
  return {
    id: 'city-1',
    name: 'New Haven',
    era: 'settlement',
    coins: STARTING_COINS,
    population: STARTING_POPULATION,
    housingCapacity: 0,
    populationProgress: 0,
    ageSec: 0,
    satisfaction: 0 // no services yet; first tick confirms the snapshot
  };
}

export function createFreshGameState(cloudEnabled: boolean): GameState {
  const base = createInitialState();
  const now = nowIso();
  return {
    ...base,
    city: createStarterCity(),
    cloudEnabled,
    timestamps: { lastActiveAt: now, createdAt: now, updatedAt: now, saveRevision: 0 }
  };
}

/** Shape guard for loaded saves (local or future cloud). */
export function isValidBuildingInstance(b: unknown): b is BuildingInstance {
  if (typeof b !== 'object' || b === null) return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.type === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    typeof o.level === 'number'
  );
}
