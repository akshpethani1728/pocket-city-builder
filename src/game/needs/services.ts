import type { BuildingInstance } from '../state/types';
import { statsForInstance } from '../buildings/stats';
import type { NeedKey, ServiceCapacities, TechModifiers } from '../config/types';

/** The needs every citizen has ( Phase 6: exactly three ). */
export const NEEDS: NeedKey[] = ['healthcare', 'education', 'recreation'];

export const NEED_LABELS: Record<NeedKey, string> = {
  healthcare: 'Healthcare',
  education: 'Education',
  recreation: 'Recreation'
};

const EMPTY: ServiceCapacities = { healthcare: 0, education: 0, recreation: 0 };

/**
 * Aggregate service capacity from definitions — generic over needs, so new
 * service buildings work without touching this file. Unknown defs give 0.
 */
export function totalServiceCapacity(buildings: BuildingInstance[], mods?: TechModifiers): ServiceCapacities {
  const total: ServiceCapacities = { ...EMPTY };
  for (const b of buildings) {
    const svc = statsForInstance(b, mods).services;
    for (const need of NEEDS) {
      total[need] += svc[need];
    }
  }
  return total;
}

/**
 * Coverage for one need: capacity / population, clamped 0..1.
 * Zero population means no demand → full coverage (also avoids div-by-zero).
 */
export function needCoverage(population: number, capacity: number): number {
  if (!Number.isFinite(population) || population <= 0) return 1;
  if (!Number.isFinite(capacity) || capacity <= 0) return 0;
  return Math.min(1, capacity / population);
}

export type CoverageMap = Record<NeedKey, number>;

export function coverageMap(population: number, capacity: ServiceCapacities): CoverageMap {
  return {
    healthcare: needCoverage(population, capacity.healthcare),
    education: needCoverage(population, capacity.education),
    recreation: needCoverage(population, capacity.recreation)
  };
}
