import type { GameState } from '../state/types';
import { getBuildingDef } from '../data/buildings';
import { statsForInstance } from '../buildings/stats';
import { techModifiersFor } from '../progression/technology';
import { incomeBreakdown, type IncomeBreakdown } from './tax';
import { chargeUpTo } from './funds';
import { nowIso } from '../sim/clock';

/**
 * Building maintenance — Phase 7.
 * Total upkeep summed from EFFECTIVE stats (definition × level, no per-type
 * branching; unknown defs contribute 0). Pure in (state, dtSec) and
 * chunk-invariant: cost = rate × dt, fractional, floored only for display.
 *
 * Shortfall policy (documented choice): funds floor at exactly $0, the
 * unpaid remainder is dropped (reported, not stored — no debt ledger this
 * phase), and services keep running. No shutdowns, no bankruptcy, no
 * satisfaction coupling: upkeep affects funds only.
 */

export interface MaintenanceBreakdown {
  totalPerSec: number;
  totalPerMin: number;
  byBuildingType: Record<string, number>; // per-sec upkeep of one building
  byCategory: Record<string, number>; // summed per-sec upkeep
}

/** Current upkeep rates for any state (sim AND hud read the same numbers). */
export function maintenanceBreakdown(state: GameState): MaintenanceBreakdown {
  const byBuildingType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let totalPerSec = 0;
  for (const b of state.buildings) {
    const rate = statsForInstance(b, techModifiersFor(state.technologies.unlocked)).upkeepPerSec;
    if (rate <= 0) continue;
    totalPerSec += rate;
    if (!(b.type in byBuildingType)) byBuildingType[b.type] = rate;
    const def = getBuildingDef(b.type);
    const cat = def ? def.category : 'unknown';
    byCategory[cat] = (byCategory[cat] ?? 0) + rate;
  }
  return { totalPerSec, totalPerMin: totalPerSec * 60, byBuildingType, byCategory };
}

export function simulateMaintenance(state: GameState, dtSec: number): GameState {
  if (!state.city) return state;
  if (!Number.isFinite(dtSec) || dtSec <= 0) return state;
  const { totalPerSec } = maintenanceBreakdown(state);
  if (totalPerSec <= 0) return state;
  const { remaining } = chargeUpTo(state.city.coins, totalPerSec * dtSec);
  if (remaining === state.city.coins) return state;
  return {
    ...state,
    city: { ...state.city, coins: remaining },
    timestamps: { ...state.timestamps, updatedAt: nowIso() }
  };
}

export interface EconomySummary {
  income: IncomeBreakdown;
  maintenancePerSec: number;
  maintenancePerMin: number;
  netPerSec: number;
  netPerMin: number;
}

/** Gross income − upkeep = net. Derived on read; never persisted. */
export function economySummary(state: GameState): EconomySummary {
  const income = incomeBreakdown(state);
  const { totalPerSec, totalPerMin } = maintenanceBreakdown(state);
  const netPerSec = income.totalPerSec - totalPerSec;
  return {
    income,
    maintenancePerSec: totalPerSec,
    maintenancePerMin: totalPerMin,
    netPerSec,
    netPerMin: netPerSec * 60
  };
}
