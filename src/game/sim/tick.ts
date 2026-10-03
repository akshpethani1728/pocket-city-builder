import type { GameState } from '../state/types';
import type { GameStore } from '../state/store';
import { MAX_ONLINE_DT_SEC } from '../data/population';
import { simulateNeeds } from '../needs/snapshot';
import { simulatePopulation } from '../population/growth';
import { simulateProgression } from '../progression/progression';
import { simulateTax } from '../economy/tax';
import { simulateMaintenance } from '../economy/maintenance';

/**
 * Tick engine — Phase 9 pipeline (fixed order, no cycles):
 *   1. simulateNeeds:       satisfaction snapshot from (buildings, pop, tech)
 *   2. simulatePopulation:  growth/decline from (satisfaction, housing, dt)
 *   3. simulateProgression: highestStageId ratchet from updated pop
 *   4. simulateTax:         income from (updated pop, buildings, tech, dt)
 *   5. simulateMaintenance: upkeep from (buildings, levels, dt)
 * Each system is an independent pure module; later phases append
 * modifiers here (never in UI/render).
 * advanceGame is pure and deterministic in dtSec.
 */
export function advanceGame(state: GameState, dtSec: number): GameState {
  const dt = Math.min(Math.max(0, dtSec), MAX_ONLINE_DT_SEC);
  let next = simulateNeeds(state);
  next = simulatePopulation(next, dt, next.city ? next.city.satisfaction : 0);
  next = simulateProgression(next);
  next = simulateTax(next, dt);
  next = simulateMaintenance(next, dt);
  return next;
}

export interface TickDriver {
  stop: () => void;
}

/**
 * Online tick driver: 1s interval, dt measured from its own clock.
 * Writes to the store ONLY when the sim actually changed something.
 * Offline catch-up is a dedicated later phase (server time + caps).
 */
export function startTickDriver(store: GameStore, intervalMs = 1000): TickDriver {
  let last = Date.now();
  const id = window.setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    const next = advanceGame(store.get(), dt);
    if (next !== store.get()) store.set(next);
  }, intervalMs);
  return { stop: () => window.clearInterval(id) };
}
