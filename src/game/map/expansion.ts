import type { BuildingInstance } from '../state/types';
import type { MapDef, TerrainType, TileCoord } from './types';
import { isInsideMap } from './types';
import { isoParamsFor, tileToWorld } from './iso';
import {
  CORE_RECT,
  EXPANSIONS,
  FULL_COLS,
  FULL_ROWS,
  LEGACY_OFFSET,
  getExpansionDef,
  type ExpansionDef
} from '../data/expansions';

/**
 * Expansion map model — Phase 10.
 * The world is ONE fixed 24×24 grid. The core 12×12 is always grass;
 * purchased zones become grass; everything else stays locked terrain.
 * Only unlocked ids persist — tiles, counts and decor derive from defs.
 */

const CORE_TREES = [
  { col: 1, row: 2 },
  { col: 9, row: 1 },
  { col: 2, row: 8 },
  { col: 7, row: 9 },
  { col: 10, row: 7 },
  { col: 4, row: 4 }
].map((t) => ({ col: t.col + CORE_RECT.col, row: t.row + CORE_RECT.row, kind: 'tree' as const }));

function inRect(col: number, row: number, r: { col: number; row: number; w: number; h: number }): boolean {
  return col >= r.col && row >= r.row && col < r.col + r.w && row < r.row + r.h;
}

/** Full world definition for the given unlocked zone ids (unknown ids ignored). */
export function buildMapDef(unlockedIds: string[]): MapDef {
  const unlocked = new Set(unlockedIds);
  const zones = EXPANSIONS.filter((e) => unlocked.has(e.id));
  const terrain: TerrainType[] = new Array<TerrainType>(FULL_COLS * FULL_ROWS).fill('locked');
  const paint = (r: { col: number; row: number; w: number; h: number }) => {
    for (let row = r.row; row < r.row + r.h; row++) {
      for (let col = r.col; col < r.col + r.w; col++) {
        if (col >= 0 && row >= 0 && col < FULL_COLS && row < FULL_ROWS) {
          terrain[row * FULL_COLS + col] = 'grass';
        }
      }
    }
  };
  paint(CORE_RECT);
  for (const z of zones) paint(z);
  return {
    cols: FULL_COLS,
    rows: FULL_ROWS,
    tileW: 96,
    tileH: 48,
    terrain: terrain,
    decor: [...CORE_TREES, ...zones.flatMap((z) => z.decor)],
    expansionZones: EXPANSIONS.map((e) => ({ id: e.id, col: e.col, row: e.row, w: e.w, h: e.h }))
  };
}

/** Number of buildable (grass) tiles in a map definition. */
export function buildableTileCount(def: MapDef): number {
  if (!def.terrain) return def.cols * def.rows;
  let n = 0;
  for (const t of def.terrain) if (t !== 'locked') n++;
  return n;
}

export type TileZone =
  | { kind: 'core' }
  | { kind: 'zone'; expansion: ExpansionDef; unlocked: boolean }
  | { kind: 'wild' };

/** Which region owns a tile (wild = permanently locked corners/edges). */
export function zoneAtTile(col: number, row: number, unlockedIds: string[]): TileZone {
  const unlocked = new Set(unlockedIds);
  if (inRect(col, row, CORE_RECT)) return { kind: 'core' };
  const zone = EXPANSIONS.find((e) => inRect(col, row, e));
  if (zone) return { kind: 'zone', expansion: zone, unlocked: unlocked.has(zone.id) };
  return { kind: 'wild' };
}

/** Do any two expansion rects (or core) overlap? Defensive config check. */
export function expansionRectsOverlap(): boolean {
  const rects = [CORE_RECT, ...EXPANSIONS];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlap = a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h;
      if (overlap) return true;
    }
  }
  return false;
}

/** All zone rects fully inside the world grid? */
export function expansionRectsInBounds(def: MapDef): boolean {
  const rects = [CORE_RECT, ...EXPANSIONS];
  return rects.every((r) => isInsideMap(def, r.col, r.row) && isInsideMap(def, r.col + r.w - 1, r.row + r.h - 1));
}

/**
 * Migrate pre-expansion saves (12×12 origin-based) into the full grid.
 * Only applied when the save has no map field at all.
 */
export function migrateBuildingsToFullMap(buildings: BuildingInstance[]): BuildingInstance[] {
  return buildings.map((b) => ({ ...b, x: b.x + LEGACY_OFFSET.col, y: b.y + LEGACY_OFFSET.row }));
}

export function tileKey(t: TileCoord): string {
  return `${t.col},${t.row}`;
}

/** World-space anchor (zone center) for renderer goal badges. */
export function zoneBadgeWorld(exp: { col: number; row: number; w: number; h: number }): { x: number; y: number } {
  const p = isoParamsFor({ cols: FULL_COLS, rows: FULL_ROWS, tileW: 96, tileH: 48, decor: [], expansionZones: [] });
  // Center of the rect in tile space, mapped through the projection.
  const fc = exp.col + (exp.w - 1) / 2;
  const fr = exp.row + (exp.h - 1) / 2;
  return {
    x: ((fc - fr) * p.tileW) / 2 + p.offsetX,
    y: ((fc + fr) * p.tileH) / 2 + p.offsetY
  };
}
export function coreWorldBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
  /** World-space bounds of the settled core (initial camera framing). */
  const p = isoParamsFor({ cols: FULL_COLS, rows: FULL_ROWS, tileW: 96, tileH: 48, decor: [], expansionZones: [] });
  const corners = [
    tileToWorld(p, CORE_RECT.col, CORE_RECT.row),
    tileToWorld(p, CORE_RECT.col + CORE_RECT.w - 1, CORE_RECT.row),
    tileToWorld(p, CORE_RECT.col, CORE_RECT.row + CORE_RECT.h - 1),
    tileToWorld(p, CORE_RECT.col + CORE_RECT.w - 1, CORE_RECT.row + CORE_RECT.h - 1)
  ];
  const halfW = 96 / 2;
  const halfH = 48 / 2;
  return {
    minX: Math.min(...corners.map((c) => c.x)) - halfW,
    maxX: Math.max(...corners.map((c) => c.x)) + halfW,
    minY: Math.min(...corners.map((c) => c.y)) - halfH,
    maxY: Math.max(...corners.map((c) => c.y)) + halfH
  };
}
