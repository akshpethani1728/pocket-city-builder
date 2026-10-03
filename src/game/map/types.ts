/**
 * Map/world model types — Phase 2.
 * Data-driven: the map is a definition + helpers, never hand-placed DOM nodes.
 * Buildings/roads/decorations plug into these slots in later phases.
 */

export interface TileCoord {
  col: number;
  row: number;
}

export type TerrainType = 'grass' | 'locked';

export interface DecorItem {
  col: number;
  row: number;
  kind: 'tree';
}

export interface ExpansionZone {
  id: string;
  col: number;
  row: number;
  w: number;
  h: number;
}

export interface MapDef {
  cols: number;
  rows: number;
  /** Base tile size in world units at zoom 1 (2:1 dimetric diamond). */
  tileW: number;
  tileH: number;
  /** Per-tile terrain, row-major, length cols*rows. Absent = all grass. */
  terrain?: TerrainType[];
  /** Fixed decorative props (trees). Buildings use a separate layer later. */
  decor: DecorItem[];
  /** Locked for future expansion; empty for the prototype. */
  expansionZones: ExpansionZone[];
}

export function tileIndex(def: MapDef, col: number, row: number): number {
  return row * def.cols + col;
}

export function isInsideMap(def: MapDef, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < def.cols && row < def.rows;
}

/** A tile is buildable when inside the map and not locked terrain. */
export function isBuildableTile(def: MapDef, col: number, row: number): boolean {
  if (!isInsideMap(def, col, row)) return false;
  if (!def.terrain) return true;
  return def.terrain[tileIndex(def, col, row)] !== 'locked';
}
