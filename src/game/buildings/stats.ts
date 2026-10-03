import type { BuildingInstance } from '../state/types';
import { getBuildingDef } from '../data/buildings';
import { NO_MODIFIERS } from '../progression/technology';
import type { NeedKey, TechModifiers } from '../config/types';

/**
 * SINGLE SOURCE OF TRUTH for effective building statistics.
 * Every system (housing, needs, tax, maintenance, renderer, UI) derives
 * from definition + instance level through here — never reads base fields
 * directly. Derived values are computed, never persisted.
 */

export interface EffectiveStats {
  level: number;
  housing: number;
  services: Record<NeedKey, number>;
  incomePerSec: number;
  upkeepPerSec: number;
}

const ZERO: EffectiveStats = {
  level: 1,
  housing: 0,
  services: { healthcare: 0, education: 0, recreation: 0 },
  incomePerSec: 0,
  upkeepPerSec: 0
};

/** Clamp any stored level into a safe integer ≥ 1 (max enforced by upgrade path). */
export function sanitizeLevel(level: unknown): number {
  if (typeof level !== 'number' || !Number.isFinite(level)) return 1;
  return Math.max(1, Math.floor(level));
}

function scale(base: number, k: number, level: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!Number.isFinite(k) || k < 0) return base;
  return base * (1 + k * (level - 1));
}

export function effectiveStats(type: string, level: number, mods?: TechModifiers): EffectiveStats {
  const def = getBuildingDef(type);
  const lvl = sanitizeLevel(level);
  if (!def) return { ...ZERO, level: lvl };
  const sc = def.levelScaling;
  const m = mods ?? NO_MODIFIERS;
  const svcBonus = m.serviceBonus ?? ZERO.services;
  const bonus = (v: number | undefined) => (Number.isFinite(v) && (v as number) > 0 ? (v as number) : 0);
  return {
    level: lvl,
    housing: Math.max(0, Math.floor(scale(def.housingCapacity, sc ? sc.housing : 0, lvl) * (1 + bonus(m.housingBonus)))),
    services: {
      healthcare: Math.max(0, scale(def.services.healthcare, sc ? sc.service : 0, lvl) * (1 + bonus(svcBonus.healthcare))),
      education: Math.max(0, scale(def.services.education, sc ? sc.service : 0, lvl) * (1 + bonus(svcBonus.education))),
      recreation: Math.max(0, scale(def.services.recreation, sc ? sc.service : 0, lvl) * (1 + bonus(svcBonus.recreation)))
    },
    incomePerSec: Math.max(0, scale(def.incomePerSec, sc ? sc.income : 0, lvl) * (1 + bonus(m.incomeBonus))),
    upkeepPerSec: Math.max(0, scale(def.upkeepPerSec, sc ? sc.upkeep : 0, lvl))
  };
}

export function statsForInstance(b: BuildingInstance, mods?: TechModifiers): EffectiveStats {
  return effectiveStats(b.type, b.level, mods);
}
