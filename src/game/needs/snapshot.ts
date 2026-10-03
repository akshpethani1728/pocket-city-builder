import type { GameState } from '../state/types';
import { totalServiceCapacity, coverageMap } from './services';
import { overallSatisfaction } from './satisfaction';
import { techModifiersFor } from '../progression/technology';
import { nowIso } from '../sim/clock';

/**
 * Satisfaction snapshot writer — the ONLY writer of city.satisfaction.
 * Derived deterministically from (buildings, population, tech); HUD and
 * future systems read the snapshot, never recompute authority.
 * Same reference when unchanged.
 */
export function simulateNeeds(state: GameState): GameState {
  if (!state.city) return state;
  const pop = Number.isFinite(state.city.population) && state.city.population > 0
    ? Math.floor(state.city.population)
    : 0;
  const capacity = totalServiceCapacity(state.buildings, techModifiersFor(state.technologies.unlocked));
  const satisfaction = overallSatisfaction(coverageMap(pop, capacity));
  if (satisfaction === state.city.satisfaction) return state;
  return {
    ...state,
    city: { ...state.city, satisfaction },
    timestamps: { ...state.timestamps, updatedAt: nowIso() }
  };
}
