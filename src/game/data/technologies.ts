/**
 * Technology catalog — Phase 9. Small set of permanent one-time bonuses.
 * Effects are data ({ target, bonus }) consumed by techModifiersFor();
 * no sim module hardcodes a technology id.
 */

export type TechTarget = 'housing' | 'healthcare' | 'education' | 'recreation' | 'business' | 'costs';

export interface TechEffect {
  target: TechTarget;
  /** Additive fraction: 0.10 = +10% (costs: 0.05 = −5% prices). */
  bonus: number;
}

export interface TechDef {
  id: string;
  name: string;
  description: string;
  /** Research price (full price; no self-discount). */
  cost: number;
  requirement: { stage: string };
  effects: TechEffect[];
}

export const TECHS: TechDef[] = [
  {
    id: 'basic-infrastructure',
    name: 'Basic Infrastructure',
    description: 'Planned plots and paths. Homes hold more citizens.',
    cost: 3000,
    requirement: { stage: 'village' },
    effects: [{ target: 'housing', bonus: 0.1 }]
  },
  {
    id: 'commercial-development',
    name: 'Commercial Development',
    description: 'Busy high streets. Shops earn more.',
    cost: 5000,
    requirement: { stage: 'town' },
    effects: [{ target: 'business', bonus: 0.1 }]
  },
  {
    id: 'advanced-healthcare',
    name: 'Advanced Healthcare',
    description: 'Better equipment and training for clinics.',
    cost: 6000,
    requirement: { stage: 'town' },
    effects: [{ target: 'healthcare', bonus: 0.15 }]
  },
  {
    id: 'modern-education',
    name: 'Modern Education',
    description: 'New curricula and libraries for schools.',
    cost: 8000,
    requirement: { stage: 'city' },
    effects: [{ target: 'education', bonus: 0.15 }]
  },
  {
    id: 'urban-planning',
    name: 'Urban Planning',
    description: 'Efficient permits. Construction and upgrades cost less.',
    cost: 12000,
    requirement: { stage: 'metropolis' },
    effects: [{ target: 'costs', bonus: 0.05 }]
  }
];

export function getTechDef(id: string): TechDef | undefined {
  return TECHS.find((t) => t.id === id);
}

const TARGET_LABELS: Record<TechTarget, string> = {
  housing: 'Housing capacity',
  healthcare: 'Healthcare',
  education: 'Education',
  recreation: 'Recreation',
  business: 'Business income',
  costs: 'Construction costs'
};

/** Human-readable effect lines ("Housing capacity +10%"). */
export function techEffectSummary(def: TechDef): string[] {
  return def.effects.map((e) => {
    const pct = Math.round(e.bonus * 100);
    return e.target === 'costs'
      ? `${TARGET_LABELS[e.target]} −${pct}%`
      : `${TARGET_LABELS[e.target]} +${pct}%`;
  });
}
