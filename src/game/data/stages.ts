/**
 * City stages — Phase 9 tuning. Population thresholds only (money,
 * happiness, buildings are NOT requirements in this version).
 * Order in this array IS the progression order; never reorder lightly.
 */

export interface StageDef {
  id: string;
  name: string;
  icon: string;
  /** Population needed to enter this stage. */
  popRequired: number;
}

export const STAGES: StageDef[] = [
  { id: 'settlement', name: 'Settlement', icon: '🌱', popRequired: 0 },
  { id: 'village', name: 'Village', icon: '🏘️', popRequired: 25 },
  { id: 'town', name: 'Town', icon: '🏙️', popRequired: 75 },
  { id: 'city', name: 'City', icon: '🌆', popRequired: 200 },
  { id: 'metropolis', name: 'Metropolis', icon: '🌃', popRequired: 500 },
  { id: 'civilization', name: 'Civilization', icon: '🏛️', popRequired: 1000 }
];

export const START_STAGE_ID = 'settlement';

export function getStageDef(id: string): StageDef | undefined {
  return STAGES.find((s) => s.id === id);
}
