import type { CoverageMap } from './services';

/**
 * Overall satisfaction = mean of need coverages, 0..1. Pure and
 * deterministic; the tick writes the snapshot, the HUD only reads it.
 */
export function overallSatisfaction(coverage: CoverageMap): number {
  const v = (coverage.healthcare + coverage.education + coverage.recreation) / 3;
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export type SatisfactionBand = 'good' | 'warning' | 'poor' | 'critical';

export function satisfactionBand(satisfaction: number): SatisfactionBand {
  if (satisfaction >= 0.8) return 'good';
  if (satisfaction >= 0.5) return 'warning';
  if (satisfaction >= 0.25) return 'poor';
  return 'critical';
}
