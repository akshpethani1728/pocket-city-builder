import type { DecorItem } from '../map/types';

/**
 * Expansion catalog — Phase 10. Each zone is a fixed rect of the 24×24
 * world grid (core island: cols/rows 6..17). Prices and stage gates live
 * here; nothing else hardcodes them. Corners stay permanently locked
 * (visual buffer + room for future content).
 */

export interface ExpansionDef {
  id: string;
  name: string;
  icon: string;
  /** Purchase price (capital expense, no upkeep, no income). */
  cost: number;
  /** Stage gate, evaluated through the shared unlock system. */
  requiredStage: string;
  col: number;
  row: number;
  w: number;
  h: number;
  decor: DecorItem[];
}

export const FULL_COLS = 24;
export const FULL_ROWS = 24;

/** Original 12×12 settlement, permanently unlocked. */
export const CORE_RECT = { col: 6, row: 6, w: 12, h: 12 };

/** Offset mapping pre-expansion (12×12, origin-based) saves into the full grid. */
export const LEGACY_OFFSET = { col: 6, row: 6 };

export const EXPANSIONS: ExpansionDef[] = [
  {
    id: 'north-meadow',
    name: 'North Meadow',
    icon: '🌳',
    cost: 5000,
    requiredStage: 'village',
    col: 6,
    row: 0,
    w: 12,
    h: 6,
    decor: [
      { col: 8, row: 2, kind: 'tree' },
      { col: 14, row: 3, kind: 'tree' },
      { col: 11, row: 4, kind: 'tree' }
    ]
  },
  {
    id: 'east-fields',
    name: 'East Fields',
    icon: '🌾',
    cost: 10000,
    requiredStage: 'town',
    col: 18,
    row: 6,
    w: 6,
    h: 12,
    decor: [
      { col: 20, row: 8, kind: 'tree' },
      { col: 19, row: 14, kind: 'tree' }
    ]
  },
  {
    id: 'west-ridge',
    name: 'West Ridge',
    icon: '⛰️',
    cost: 20000,
    requiredStage: 'city',
    col: 0,
    row: 6,
    w: 6,
    h: 12,
    decor: [
      { col: 2, row: 9, kind: 'tree' },
      { col: 4, row: 15, kind: 'tree' }
    ]
  },
  {
    id: 'south-plains',
    name: 'South Plains',
    icon: '🌻',
    cost: 35000,
    requiredStage: 'metropolis',
    col: 6,
    row: 18,
    w: 12,
    h: 6,
    decor: [
      { col: 9, row: 20, kind: 'tree' },
      { col: 15, row: 21, kind: 'tree' }
    ]
  }
];

export function getExpansionDef(id: string): ExpansionDef | undefined {
  return EXPANSIONS.find((e) => e.id === id);
}
