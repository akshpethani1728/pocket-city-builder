import type { GameState } from '../state/types';
import { MOVE_IN_PER_SEC } from '../data/population';
import { NEW_CITY_GRACE_SEC, MOVE_OUT_PER_SEC, SAT_FULL, SAT_SLOW, SAT_STALL, SLOW_GROWTH_FACTOR } from '../data/needs';
import { techModifiersFor } from '../progression/technology';
import { totalHousingCapacity } from './housing';
import { nowIso } from '../sim/clock';

/**
 * Deterministic population step with satisfaction bands.
 * Pure in (state, dtSec, satisfaction): same inputs → same outputs,
 * chunk-invariant (float epsilon), offline-ready (larger dt later).
 *
 * Bands (satisfaction 0..1): ≥0.8 full growth, ≥0.5 half growth,
 * ≥0.25 stall, below → gradual decline. New cities (age < grace) never
 * decline — pioneers can't die before services can be built.
 *
 * Invariants: growth never exceeds housing capacity; pop never negative;
 * decline is independent of housing. Same reference when nothing changed.
 */
export function simulatePopulation(state: GameState, dtSec: number, satisfaction: number): GameState {
  if (!state.city) return state;
  const capacity = totalHousingCapacity(state.buildings, techModifiersFor(state.technologies.unlocked));
  const dt = Number.isFinite(dtSec) ? dtSec : 0;

  if (dt <= 0) {
    // Refresh capacity only (e.g. right after construction).
    if (capacity === state.city.housingCapacity) return state;
    return {
      ...state,
      city: { ...state.city, housingCapacity: capacity },
      timestamps: { ...state.timestamps, updatedAt: nowIso() }
    };
  }

  const sat = Number.isFinite(satisfaction) ? Math.min(1, Math.max(0, satisfaction)) : 0;
  const ageSec = state.city.ageSec + dt;
  const graced = ageSec < NEW_CITY_GRACE_SEC;

  let rate: number;
  if (sat >= SAT_FULL) rate = MOVE_IN_PER_SEC;
  else if (sat >= SAT_SLOW) rate = MOVE_IN_PER_SEC * SLOW_GROWTH_FACTOR;
  else if (sat >= SAT_STALL || graced) rate = 0;
  else rate = -MOVE_OUT_PER_SEC;

  let population = state.city.population;
  let progress = state.city.populationProgress + dt * rate;
  const free = capacity - population;

  // Signed whole citizens; epsilon keeps chunked ticks consistent.
  let delta = progress >= 0 ? Math.floor(progress + 1e-9) : Math.ceil(progress - 1e-9);
  if (delta > 0) delta = Math.min(delta, Math.max(0, free));
  else delta = Math.max(delta, -population);
  population += delta;
  progress -= delta;

  if (population === state.city.population && capacity === state.city.housingCapacity &&
      progress === state.city.populationProgress && ageSec === state.city.ageSec) {
    return state;
  }
  return {
    ...state,
    city: { ...state.city, population, housingCapacity: capacity, populationProgress: progress, ageSec },
    timestamps: { ...state.timestamps, updatedAt: nowIso() }
  };
}
