import { meetsStage } from './stages';

/**
 * Unlock system — generic over target kinds. Buildings gate on
 * `unlockRequirement: { stage: '<id>' }`; technologies gate on their own
 * requirement field. Future kinds (feature, area, era) reuse meetsStage().
 */

export type UnlockKind = 'building' | 'technology' | 'feature';

export interface UnlockStatus {
  unlocked: boolean;
  /** Stage id gating this content, if any. */
  requiredStageId: string | null;
}

export function unlockStatusForStage(
  requirement: Record<string, number | string> | null | undefined,
  highestStageId: string
): UnlockStatus {
  const req = requirement && typeof requirement.stage === 'string' ? requirement.stage : null;
  if (!req) return { unlocked: true, requiredStageId: null };
  return { unlocked: meetsStage(highestStageId, req), requiredStageId: req };
}
