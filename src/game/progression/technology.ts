import type { GameState } from '../state/types';
import type { TechModifiers } from '../config/types';
import { TECHS, getTechDef, type TechDef } from '../data/technologies';
import { unlockStatusForStage } from './unlocks';
import { trySpend } from '../economy/funds';
import { nowIso } from '../sim/clock';

/**
 * Technology research + modifiers. Effects aggregate additively from
 * researched ids (unknown ids ignored). Modifiers flow into
 * effectiveStats() explicitly — no globals, fully testable.
 */

export const NO_MODIFIERS: TechModifiers = {
  housingBonus: 0,
  serviceBonus: { healthcare: 0, education: 0, recreation: 0 },
  incomeBonus: 0,
  costDiscount: 0
};

export function techModifiersFor(researchedIds: string[]): TechModifiers {
  const mods: TechModifiers = {
    housingBonus: 0,
    serviceBonus: { healthcare: 0, education: 0, recreation: 0 },
    incomeBonus: 0,
    costDiscount: 0
  };
  for (const id of researchedIds) {
    const def = getTechDef(id);
    if (!def) continue;
    for (const e of def.effects) {
      if (!Number.isFinite(e.bonus) || e.bonus <= 0) continue;
      switch (e.target) {
        case 'housing':
          mods.housingBonus += e.bonus;
          break;
        case 'healthcare':
          mods.serviceBonus.healthcare += e.bonus;
          break;
        case 'education':
          mods.serviceBonus.education += e.bonus;
          break;
        case 'recreation':
          mods.serviceBonus.recreation += e.bonus;
          break;
        case 'business':
          mods.incomeBonus += e.bonus;
          break;
        case 'costs':
          mods.costDiscount += e.bonus;
          break;
      }
    }
  }
  mods.costDiscount = Math.min(0.9, Math.max(0, mods.costDiscount));
  return mods;
}

/** Is this technology purchasable at the given highest stage? */
export function isTechAvailable(def: TechDef, highestStageId: string): boolean {
  return unlockStatusForStage(def.requirement, highestStageId).unlocked;
}

export function availableTechs(highestStageId: string): TechDef[] {
  return TECHS.filter((t) => isTechAvailable(t, highestStageId));
}

export type ResearchError = 'UNKNOWN_TECH' | 'ALREADY_RESEARCHED' | 'LOCKED' | 'NO_CITY' | 'INSUFFICIENT_FUNDS';

export type ResearchResult =
  | { ok: true; state: GameState; spent: number }
  | { ok: false; error: ResearchError; needed?: number; have?: number };

export function researchTechnology(state: GameState, techId: string): ResearchResult {
  const def = getTechDef(techId);
  if (!def) return { ok: false, error: 'UNKNOWN_TECH' };
  if (state.technologies.unlocked.includes(techId)) return { ok: false, error: 'ALREADY_RESEARCHED' };
  if (!isTechAvailable(def, state.progress.highestStageId)) return { ok: false, error: 'LOCKED' };
  if (!state.city) return { ok: false, error: 'NO_CITY' };
  const spend = trySpend(state.city.coins, def.cost);
  if (!spend.ok) return { ok: false, error: 'INSUFFICIENT_FUNDS', needed: def.cost, have: state.city.coins };
  return {
    ok: true,
    spent: def.cost,
    state: {
      ...state,
      city: { ...state.city, coins: spend.remaining },
      technologies: { unlocked: [...state.technologies.unlocked, techId] },
      timestamps: { ...state.timestamps, updatedAt: nowIso(), saveRevision: state.timestamps.saveRevision + 1 }
    }
  };
}

export const RESEARCH_MESSAGES: Record<ResearchError, string> = {
  UNKNOWN_TECH: 'Unknown technology',
  ALREADY_RESEARCHED: 'Already researched',
  LOCKED: 'Reach a later stage first',
  NO_CITY: 'No city yet',
  INSUFFICIENT_FUNDS: 'Not enough funds for research'
};
