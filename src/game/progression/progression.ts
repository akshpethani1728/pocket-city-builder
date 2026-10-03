import type { GameState } from '../state/types';
import { getStageForPopulation, stageIndex } from './stages';
import { nowIso } from '../sim/clock';

/**
 * Permanent stage progression. highestStageId only ever moves forward —
 * population decline never revokes unlocks (no Town↔Village oscillation).
 * Current stage itself stays derived from population everywhere else.
 */
export function simulateProgression(state: GameState): GameState {
  if (!state.city) return state;
  const pop = Number.isFinite(state.city.population) ? Math.max(0, Math.floor(state.city.population)) : 0;
  const current = getStageForPopulation(pop);
  if (stageIndex(current.id) <= stageIndex(state.progress.highestStageId)) return state;
  return {
    ...state,
    progress: { highestStageId: current.id },
    timestamps: { ...state.timestamps, updatedAt: nowIso() }
  };
}
