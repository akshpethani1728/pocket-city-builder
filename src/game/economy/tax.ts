import type { GameState } from '../state/types';
import { TAX_PER_CITIZEN_PER_SEC } from '../data/economy';
import { statsForInstance } from '../buildings/stats';
import { techModifiersFor } from '../progression/technology';
import { creditFunds } from './funds';
import { nowIso } from '../sim/clock';

/**
 * Recurring city income — Phase 5: population taxes + building revenue.
 * Aggregate math (no per-citizen/per-building transactions), pure in
 * (state, dtSec), chunk-invariant up to float tolerance. Reads population
 * and defs live every call, so growth/decline automatically moves income.
 *
 * Order note: the tick engine runs population BEFORE tax, so citizens who
 * arrive this tick already contribute — documented, deterministic.
 */

export interface IncomeBreakdown {
  taxPerSec: number;
  businessPerSec: number;
  totalPerSec: number;
  taxPerMin: number;
  businessPerMin: number;
  totalPerMin: number;
}

/** Current income rates for any state (used by sim AND hud — same numbers). */
export function incomeBreakdown(state: GameState): IncomeBreakdown {
  const pop = state.city && Number.isFinite(state.city.population) && state.city.population > 0
    ? Math.floor(state.city.population)
    : 0;
  let businessPerSec = 0;
  const mods = techModifiersFor(state.technologies.unlocked);
  for (const b of state.buildings) {
    businessPerSec += statsForInstance(b, mods).incomePerSec;
  }
  const taxPerSec = pop * TAX_PER_CITIZEN_PER_SEC;
  const totalPerSec = taxPerSec + businessPerSec;
  return {
    taxPerSec,
    businessPerSec,
    totalPerSec,
    taxPerMin: taxPerSec * 60,
    businessPerMin: businessPerSec * 60,
    totalPerMin: totalPerSec * 60
  };
}

export function simulateTax(state: GameState, dtSec: number): GameState {
  if (!state.city) return state;
  if (!Number.isFinite(dtSec) || dtSec <= 0) return state;
  const { totalPerSec } = incomeBreakdown(state);
  if (totalPerSec <= 0) return state;
  const credited = creditFunds(state.city.coins, totalPerSec * dtSec);
  if (credited === state.city.coins) return state;
  return {
    ...state,
    city: { ...state.city, coins: credited },
    timestamps: { ...state.timestamps, updatedAt: nowIso() }
  };
}
