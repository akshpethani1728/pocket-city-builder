import type { MapDef } from './types';

/**
 * Default prototype map: 12x12 grass island, all buildable, a few fixed trees.
 * Trees are hand-picked (not random) so the prototype is stable across loads.
 * Buildings/roads unlock their own layers in later phases.
 */
export const DEFAULT_MAP_DEF: MapDef = {
  cols: 12,
  rows: 12,
  tileW: 96,
  tileH: 48,
  decor: [
    { col: 1, row: 2, kind: 'tree' },
    { col: 9, row: 1, kind: 'tree' },
    { col: 2, row: 8, kind: 'tree' },
    { col: 7, row: 9, kind: 'tree' },
    { col: 10, row: 7, kind: 'tree' },
    { col: 4, row: 4, kind: 'tree' }
  ],
  expansionZones: []
};
