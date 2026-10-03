import type { BuildingInstance } from '../state/types';
import type { TechModifiers } from '../config/types';
import { statsForInstance } from '../buildings/stats';

/**
 * Housing capacity from EFFECTIVE stats (definition × level × tech) — no
 * per-type if/else here, so new residential buildings work automatically.
 * Unknown def ids contribute 0 (forward-compatible with removed content).
 */
export function housingForInstance(b: BuildingInstance, mods?: TechModifiers): number {
  return statsForInstance(b, mods).housing;
}

export function totalHousingCapacity(buildings: BuildingInstance[], mods?: TechModifiers): number {
  let total = 0;
  for (const b of buildings) total += housingForInstance(b, mods);
  return total;
}
