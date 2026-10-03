import type { MapDef, TileCoord } from './types';

/**
 * Pure 2:1 dimetric ("isometric-style") projection math.
 * No DOM, no canvas — fully unit-testable.
 *
 * World layout: tile (col,row) center in world units:
 *   x = (col - row) * tileW / 2
 *   y = (col + row) * tileH / 2
 * The map is centered so its bounding-box center sits at world origin.
 */

export interface IsoParams {
  tileW: number;
  tileH: number;
  /** World offset that centers the map at (0,0). */
  offsetX: number;
  offsetY: number;
}

export function isoParamsFor(def: MapDef): IsoParams {
  const { tileW, tileH } = def;
  // Bounding box spans x: [-(rows-1)*tileW/2, (cols-1)*tileW/2],
  // y: [0, (cols-1 + rows-1)*tileH/2]. Center it on origin.
  const minX = -((def.rows - 1) * tileW) / 2;
  const maxX = ((def.cols - 1) * tileW) / 2;
  const maxY = ((def.cols - 1 + (def.rows - 1)) * tileH) / 2;
  return { tileW, tileH, offsetX: -(minX + maxX) / 2, offsetY: -maxY / 2 };
}

/** Center of a tile in world units. */
export function tileToWorld(p: IsoParams, col: number, row: number): { x: number; y: number } {
  return {
    x: ((col - row) * p.tileW) / 2 + p.offsetX,
    y: ((col + row) * p.tileH) / 2 + p.offsetY
  };
}

/** Which tile contains a world point. A diamond maps to a unit square in
 * fractional tile space, so the containing tile is the ROUNDED coordinate
 * (floor would mis-assign points near the left/right corners). */
export function worldToTile(p: IsoParams, x: number, y: number): TileCoord {
  const lx = x - p.offsetX;
  const ly = y - p.offsetY;
  const col = Math.round((lx / (p.tileW / 2) + ly / (p.tileH / 2)) / 2);
  const row = Math.round((ly / (p.tileH / 2) - lx / (p.tileW / 2)) / 2);
  return { col, row };
}

/** World bounding box of the whole map (for camera clamping). */
export function mapWorldBounds(p: IsoParams, def: MapDef): { minX: number; maxX: number; minY: number; maxY: number } {
  const corners = [
    tileToWorld(p, 0, 0),
    tileToWorld(p, def.cols - 1, 0),
    tileToWorld(p, 0, def.rows - 1),
    tileToWorld(p, def.cols - 1, def.rows - 1)
  ];
  const halfW = p.tileW / 2;
  const halfH = p.tileH / 2;
  return {
    minX: Math.min(...corners.map((c) => c.x)) - halfW,
    maxX: Math.max(...corners.map((c) => c.x)) + halfW,
    minY: Math.min(...corners.map((c) => c.y)) - halfH,
    maxY: Math.max(...corners.map((c) => c.y)) + halfH
  };
}

/** Round a world point to its containing tile, then back to that tile's center. */
export function snapWorldToTileCenter(p: IsoParams, x: number, y: number): { tile: TileCoord; x: number; y: number } {
  const tile = worldToTile(p, x, y);
  const c = tileToWorld(p, tile.col, tile.row);
  return { tile, x: c.x, y: c.y };
}
