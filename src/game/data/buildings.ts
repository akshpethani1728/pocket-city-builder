import type { BuildingDef } from '../config/types';

/**
 * Phase-6 construction catalog + Phase-7 upkeep + Phase-8 levels.
 * Live fields: baseCost.coins, housingCapacity, services.*, incomePerSec,
 * upkeepPerSec, maxLevel, costGrowth (upgrade pricing), levelScaling.
 * Uniform scaling k: housing/service/income +50%/level, upkeep +40%/level.
 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'house',
    category: 'housing',
    name: 'House',
    description: 'Cozy home. Houses 4 citizens.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 500 },
    costGrowth: 1.15,
    housingCapacity: 4,
    services: { healthcare: 0, education: 0, recreation: 0 },
    incomePerSec: 0,
    upkeepPerSec: 0,
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: null
  },
  {
    id: 'park',
    category: 'recreation',
    name: 'Park',
    description: 'Green space. Recreation for 30 citizens.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 1000 },
    costGrowth: 1.15,
    housingCapacity: 0,
    services: { healthcare: 0, education: 0, recreation: 30 },
    incomePerSec: 0,
    upkeepPerSec: 0.1, // $6/min groundskeeping
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: null
  },
  {
    id: 'shop',
    category: 'commercial',
    name: 'Shop',
    description: 'Local store. Earns $60/min.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 1500 },
    costGrowth: 1.15,
    housingCapacity: 0,
    services: { healthcare: 0, education: 0, recreation: 0 },
    incomePerSec: 1,
    upkeepPerSec: 0.15, // $9/min staffing; net +$51/min
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: null
  },
  {
    id: 'apartment',
    category: 'housing',
    name: 'Apartment',
    description: 'Roomy block. Houses 20 citizens.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 2000 },
    costGrowth: 1.15,
    housingCapacity: 20,
    services: { healthcare: 0, education: 0, recreation: 0 },
    incomePerSec: 0,
    upkeepPerSec: 0,
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: null
  },
  {
    id: 'school',
    category: 'education',
    name: 'School',
    description: 'Basic learning. Education for 40 citizens.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 2500 },
    costGrowth: 1.15,
    housingCapacity: 0,
    services: { healthcare: 0, education: 40, recreation: 0 },
    incomePerSec: 0,
    upkeepPerSec: 0.2, // $12/min staff & supplies
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: null
  },
  {
    id: 'clinic',
    category: 'health',
    name: 'Clinic',
    description: 'Basic care. Healthcare for 25 citizens.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 3000 },
    costGrowth: 1.15,
    housingCapacity: 0,
    services: { healthcare: 25, education: 0, recreation: 0 },
    incomePerSec: 0, // tuned in the service-income phase
    upkeepPerSec: 0.2, // $12/min staff & supplies
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: null
  },
  {
    id: 'market',
    category: 'commercial',
    name: 'Market',
    description: 'Bustling bazaar. Earns $120/min.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 4000 },
    costGrowth: 1.15,
    housingCapacity: 0,
    services: { healthcare: 0, education: 0, recreation: 0 },
    incomePerSec: 2,
    upkeepPerSec: 0.3, // $18/min vendors; net +$102/min
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: { stage: 'village' }
  },
  {
    id: 'hospital',
    category: 'health',
    name: 'Hospital',
    description: 'Full care center. Healthcare for 100 citizens.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 8000 },
    costGrowth: 1.15,
    housingCapacity: 0,
    services: { healthcare: 100, education: 0, recreation: 0 },
    incomePerSec: 0,
    upkeepPerSec: 0.5, // $30/min staff & wards
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: { stage: 'town' }
  },
  {
    id: 'college',
    category: 'education',
    name: 'College',
    description: 'Higher learning. Education for 120 citizens.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 15000 },
    costGrowth: 1.15,
    housingCapacity: 0,
    services: { healthcare: 0, education: 120, recreation: 0 },
    incomePerSec: 0,
    upkeepPerSec: 0.8, // $48/min faculty
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: { stage: 'city' }
  },
  {
    id: 'highrise',
    category: 'housing',
    name: 'High-rise',
    description: 'Tower living. Houses 80 citizens.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 25000 },
    costGrowth: 1.15,
    housingCapacity: 80,
    services: { healthcare: 0, education: 0, recreation: 0 },
    incomePerSec: 0,
    upkeepPerSec: 0, // housing stays upkeep-free
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: { stage: 'metropolis' }
  },
  {
    id: 'landmark',
    category: 'recreation',
    name: 'Landmark',
    description: 'Pride of the city. Recreation for 150, earns $180/min.',
    size: { w: 1, h: 1 },
    baseCost: { coins: 50000 },
    costGrowth: 1.15,
    housingCapacity: 0,
    services: { healthcare: 0, education: 0, recreation: 150 },
    incomePerSec: 3,
    upkeepPerSec: 1, // $60/min curation; net +$120/min
    maxLevel: 3,
    levelScaling: { housing: 0.5, service: 0.5, income: 0.5, upkeep: 0.4 },
    unlockRequirement: { stage: 'civilization' }
  }
];

/** Menu icons (emoji placeholders until real art arrives). */
export const BUILDING_ICONS: Record<string, string> = {
  house: '🏠',
  park: '🌳',
  shop: '🏪',
  apartment: '🏢',
  school: '🏫',
  clinic: '🩺',
  market: '🛒',
  hospital: '🏥',
  college: '🎓',
  highrise: '🏙️',
  landmark: '🗽'
};

export function getBuildingDef(id: string): BuildingDef | undefined {
  return BUILDINGS.find((b) => b.id === id);
}

/** Human-readable service summary for building info ("Recreation +30"). */
export function serviceSummary(def: BuildingDef): string | null {
  const labels: Record<string, string> = { healthcare: 'Healthcare', education: 'Education', recreation: 'Recreation' };
  const parts: string[] = [];
  for (const need of ['healthcare', 'education', 'recreation'] as const) {
    const v = def.services ? def.services[need] : 0;
    if (v > 0) parts.push(`${labels[need]} +${v}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}
