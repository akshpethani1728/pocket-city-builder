import type { StageDef } from '../data/stages';
import { STAGES, START_STAGE_ID, getStageDef } from '../data/stages';

/**
 * Stage evaluation — pure, population-only.
 * Highest stage whose threshold is met; safe for 0/NaN/negative pop.
 */
export function getStageForPopulation(population: number): StageDef {
  const pop = Number.isFinite(population) ? Math.max(0, Math.floor(population)) : 0;
  let current = STAGES[0];
  for (const stage of STAGES) {
    if (pop >= stage.popRequired) current = stage;
    else break;
  }
  return current;
}

export function stageIndex(id: string): number {
  const i = STAGES.findIndex((s) => s.id === id);
  return i >= 0 ? i : 0;
}

/** Next stage after `id`, or null at the peak. */
export function nextStage(id: string): StageDef | null {
  const i = stageIndex(id);
  return i < STAGES.length - 1 ? STAGES[i + 1] : null;
}

/** Has `highestId` reached at least `requiredId`? Unknown ids → false. */
export function meetsStage(highestId: string, requiredId: string): boolean {
  if (!getStageDef(highestId) || !getStageDef(requiredId)) return false;
  return stageIndex(highestId) >= stageIndex(requiredId);
}

export function sanitizeStageId(id: unknown): string {
  return typeof id === 'string' && getStageDef(id) ? id : START_STAGE_ID;
}
