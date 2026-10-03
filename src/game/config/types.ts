/**
 * Data-driven config types. Content lives in data files later;
 * engine code must never hardcode building costs/effects.
 * Phase 1: types + empty registry only. No balance values yet.
 */

export type ServiceType = 'housing' | 'health' | 'education' | 'recreation' | 'commercial' | 'infrastructure';

/** Citizen needs covered by the satisfaction system (extendable later). */
export type NeedKey = 'healthcare' | 'education' | 'recreation';

export type ServiceCapacities = Record<NeedKey, number>;

export interface BuildingCost {
  coins: number;
}

/**
 * Per-level linear scaling for effective stats:
 *   effective = base × (1 + k × (level − 1))
 * Housing floors to whole citizens; other stats keep full precision
 * (display rounds). A future Hospital sets its own base + k values here
 * with zero sim changes.
 */
export interface LevelScaling {
  housing: number;
  service: number;
  income: number;
  upkeep: number;
}

export interface BuildingDef {
  id: string;
  category: ServiceType;
  name: string;
  description: string;
  /** Tiles occupied, e.g. { w: 1, h: 1 }. Real grid arrives Phase 2. */
  size: { w: number; h: number };
  baseCost: BuildingCost;
  /** Upgrade price multiplier: upgrade L→L+1 costs round(base × costGrowth^L). */
  costGrowth: number;
  housingCapacity: number;
  /** Per-need service capacity (e.g. { healthcare: 25, education: 0, ... }). */
  services: ServiceCapacities;
  incomePerSec: number;
  upkeepPerSec: number;
  maxLevel: number;
  /** Level scaling for effective stats (Phase 8). */
  levelScaling: LevelScaling;
  /** Milestone/unlock gate, e.g. { population: 800 }. */
  unlockRequirement: Record<string, number | string> | null;
}

export interface EconomyRules {
  taxPerCitizenPerSec: number;
  offlineCapHours: number;
}

export interface PopulationRules {
  baseMoveInPerSec: number;
  baseMoveOutPerSec: number;
  satisfactionMoveInThreshold: number;
  satisfactionMoveOutThreshold: number;
}

export interface TechnologyDef {
  id: string;
  name: string;
  description: string;
  requirement: Record<string, number | string> | null;
}

/**
 * Aggregated technology bonuses (all additive fractions, e.g. 0.10 = +10%).
 * Computed from researched ids; applied inside effectiveStats().
 */
export interface TechModifiers {
  housingBonus: number;
  serviceBonus: Record<NeedKey, number>;
  incomeBonus: number;
  costDiscount: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  target: number;
}

export interface UnlockDef {
  id: string;
  kind: 'building' | 'feature' | 'area' | 'era';
  requirement: Record<string, number | string> | null;
}
