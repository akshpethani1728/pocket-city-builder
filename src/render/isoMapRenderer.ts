import type { MapDef, TileCoord } from '../game/map/types';
import { isBuildableTile } from '../game/map/types';
import { isoParamsFor, mapWorldBounds, tileToWorld, worldToTile, type IsoParams } from '../game/map/iso';
import type { BuildingInstance } from '../game/state/types';
import { paintBuilding } from './buildingArt';
import { Camera } from './camera';
import type { Renderer } from './renderer';

/**
 * Phase 2 isometric ("2.5D toy island") map renderer on plain Canvas 2D.
 * Implements the Phase 1 Renderer interface — swappable for PixiJS later
 * without touching sim, state, or UI shell.
 *
 * Perf: single canvas, render-on-demand (no continuous rAF loop),
 * DPR capped at 2, ~144 tiles + 6 trees per frame — trivial for mobile GPUs.
 */

const SKY_TOP = '#7dd3fc';
const SKY_BOTTOM = '#e0f2fe';
const GRASS_A = '#7ed491';
const GRASS_B = '#6fc984';
const LOCKED_A = '#a8b5a0';
const LOCKED_B = '#9cab98';
const EDGE = 'rgba(6, 95, 70, 0.35)';
const LOCKED_EDGE = 'rgba(71, 85, 105, 0.3)';
const SKIRT_LEFT = '#15803d';
const SKIRT_RIGHT = '#166534';
const SELECT_FILL = 'rgba(250, 204, 21, 0.55)';
const SELECT_EDGE = '#facc15';
const SELECT_TAKEN_FILL = 'rgba(248, 113, 113, 0.45)';
const SELECT_TAKEN_EDGE = '#ef4444';
const SELECT_LOCKED_FILL = 'rgba(148, 163, 184, 0.45)';
const SELECT_LOCKED_EDGE = '#94a3b8';

/** Pop-in animation length for newly placed buildings (ms). */
const POP_MS = 350;

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const u = t - 1;
  return 1 + c3 * u * u * u + c1 * u * u;
}

export interface IsoMapCallbacks {
  onSelect?: (tile: TileCoord | null) => void;
}

/** Floating label drawn over a locked expansion zone (subtle goal marker). */
export interface ZoneBadge {
  /** World coords of the badge anchor. */
  x: number;
  y: number;
  icon: string;
  title: string;
  subtitle: string;
}

export class IsoMapRenderer implements Renderer {
  private def: MapDef;
  private cb: IsoMapCallbacks;
  private iso: IsoParams;
  private camera: Camera;
  private canvas: HTMLCanvasElement | null = null;
  private ro: ResizeObserver | null = null;
  private raf = 0;
  private dirty = true;
  private dpr = 1;
  private selected: TileCoord | null = null;
  private buildings: BuildingInstance[] = [];
  private occupied = new Set<string>();
  private badges: ZoneBadge[] = [];
  /** Newly placed building ids -> placement timestamp (drives pop-in). */
  private fresh = new Map<string, number>();
  private animRunning = false;

  constructor(def: MapDef, cb: IsoMapCallbacks = {}) {
    this.def = def;
    this.cb = cb;
    this.iso = isoParamsFor(def);
    const b = mapWorldBounds(this.iso, def);
    this.camera = new Camera(
      { x: 0, y: 0, zoom: 1 },
      { minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY },
      {
        minZoom: 0.35,
        maxZoom: 3,
        margin: 60,
        onChange: () => this.requestRender(),
        onTap: (sx, sy) => this.handleTap(sx, sy)
      }
    );
  }

  mount(root: HTMLElement, initialZoom?: { minX: number; maxX: number; minY: number; maxY: number }): void {
    const canvas = document.createElement('canvas');
    canvas.className = 'map-canvas';
    canvas.setAttribute('aria-label', 'City map. Drag to pan, pinch to zoom, tap a tile to select.');
    root.appendChild(canvas);
    this.canvas = canvas;
    this.camera.attach(canvas);
    this.resize();
    // Start framed on the settled core; the full world stays pannable.
    this.camera.fitToBounds(24, initialZoom);
    this.requestRender();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(root);
  }

  resize(): void {
    if (!this.canvas || !this.canvas.parentElement) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * this.dpr));
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.camera.setViewport(rect.width, rect.height);
    this.requestRender();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.ro = null;
    this.camera.detach();
    this.canvas?.remove();
    this.canvas = null;
  }

  get selection(): TileCoord | null {
    return this.selected ? { ...this.selected } : null;
  }

  /** Replace the rendered building layer (pure view update — no game logic). */
  setBuildings(list: BuildingInstance[]): void {
    const prevKey = this.buildings.map((b) => `${b.id}@${b.level}`).join('|');
    const nextKey = list.map((b) => `${b.id}@${b.level}`).join('|');
    if (prevKey === nextKey && this.fresh.size === 0) return; // nothing changed
    const known = new Set(this.buildings.map((b) => b.id));
    const prevLevels = new Map(this.buildings.map((b) => [b.id, b.level] as const));
    const now = performance.now();
    for (const b of list) {
      // New buildings pop in; upgraded ones replay the pop at their level.
      if (!known.has(b.id) || prevLevels.get(b.id) !== b.level) this.fresh.set(b.id, now);
    }
    this.buildings = [...list];
    this.occupied = new Set(list.map((b) => `${b.x},${b.y}`));
    this.requestRender();
    this.runAnimLoop();
  }

  isOccupied(col: number, row: number): boolean {
    return this.occupied.has(`${col},${row}`);
  }

  /**
   * Swap the world definition (expansion purchase) without remounting:
   * recomputes projection, keeps camera/zoom/selection, re-renders once.
   * Camera bounds already span the full grid, so no camera change is needed.
   */
  setMapDef(def: MapDef, badges: ZoneBadge[] = []): void {
    this.def = def;
    this.iso = isoParamsFor(def);
    this.badges = badges;
    this.requestRender();
  }

  /** Bounded rAF loop that runs only while a pop-in animation is active. */
  private runAnimLoop(): void {
    if (this.animRunning || this.fresh.size === 0) return;
    this.animRunning = true;
    const step = () => {
      this.paint();
      if (this.fresh.size === 0) {
        this.animRunning = false;
        this.dirty = false;
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private requestRender(): void {
    if (!this.dirty) {
      this.dirty = true;
      this.raf = requestAnimationFrame(() => {
        this.dirty = false;
        this.paint();
      });
    }
  }

  private handleTap(sx: number, sy: number): void {
    const w = this.camera.screenToWorld(sx, sy);
    const t = worldToTile(this.iso, w.x, w.y);
    const inside =
      t.col >= 0 && t.row >= 0 && t.col < this.def.cols && t.row < this.def.rows;
    this.selected = inside ? t : null;
    this.cb.onSelect?.(this.selected ? { ...this.selected } : null);
    this.requestRender();
  }

  private paint(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const { tileW, tileH } = this.iso;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    const cssW = W / this.dpr;
    const cssH = H / this.dpr;

    // Sky background.
    const sky = ctx.createLinearGradient(0, 0, 0, cssH);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(1, SKY_BOTTOM);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, cssW, cssH);

    const cam = this.camera.snapshot;
    const toScreen = (wx: number, wy: number) => ({
      x: (wx - cam.x) * cam.zoom + cssW / 2,
      y: (wy - cam.y) * cam.zoom + cssH / 2
    });

    // Floating-island skirt: extrude the map corners downward.
    const depth = 22 * cam.zoom;
    const c00 = tileToWorld(this.iso, 0, 0);
    const cC0 = tileToWorld(this.iso, this.def.cols - 1, 0);
    const c0R = tileToWorld(this.iso, 0, this.def.rows - 1);
    const cCR = tileToWorld(this.iso, this.def.cols - 1, this.def.rows - 1);
    const hw = tileW / 2; // half tile width in world units
    const hh = tileH / 2;
    const top = [c00, cC0, cCR, c0R].map((c) => toScreen(c.x, c.y));
    // Edge midpoints of the diamond island (E/S/W corners + N for reference).
    const E = { x: top[1].x + hw * cam.zoom, y: top[1].y };
    const S = { x: top[2].x, y: top[2].y + hh * cam.zoom };
    const Wm = { x: top[3].x - hw * cam.zoom, y: top[3].y };
    ctx.fillStyle = SKIRT_LEFT;
    ctx.beginPath();
    ctx.moveTo(Wm.x, Wm.y);
    ctx.lineTo(S.x, S.y);
    ctx.lineTo(S.x, S.y + depth);
    ctx.lineTo(Wm.x, Wm.y + depth);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SKIRT_RIGHT;
    ctx.beginPath();
    ctx.moveTo(S.x, S.y);
    ctx.lineTo(E.x, E.y);
    ctx.lineTo(E.x, E.y + depth);
    ctx.lineTo(S.x, S.y + depth);
    ctx.closePath();
    ctx.fill();

    // Tiles, painter order: row+col ascending. Locked terrain renders faded.
    const zx = (tileW / 2) * cam.zoom;
    const zy = (tileH / 2) * cam.zoom;
    const terrain = this.def.terrain;
    for (let row = 0; row < this.def.rows; row++) {
      for (let col = 0; col < this.def.cols; col++) {
        const c = tileToWorld(this.iso, col, row);
        const s = toScreen(c.x, c.y);
        // View culling: skip tiles fully off-screen.
        if (s.x < -zx || s.x > cssW + zx || s.y < -zy || s.y > cssH + zy) continue;
        const locked = terrain ? terrain[row * this.def.cols + col] === 'locked' : false;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - zy);
        ctx.lineTo(s.x + zx, s.y);
        ctx.lineTo(s.x, s.y + zy);
        ctx.lineTo(s.x - zx, s.y);
        ctx.closePath();
        if (locked) {
          ctx.fillStyle = (col + row) % 2 === 0 ? LOCKED_A : LOCKED_B;
        } else {
          ctx.fillStyle = (col + row) % 2 === 0 ? GRASS_A : GRASS_B;
        }
        ctx.fill();
        ctx.strokeStyle = locked ? LOCKED_EDGE : EDGE;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Locked-zone goal badges (drawn under entities, subtle by design).
    for (const badge of this.badges) {
      const s = toScreen(badge.x, badge.y);
      if (s.x < -80 || s.x > cssW + 80 || s.y < -40 || s.y > cssH + 40) continue;
      ctx.textAlign = 'center';
      ctx.font = `${Math.max(16, 22 * cam.zoom)}px system-ui, sans-serif`;
      ctx.fillText(badge.icon, s.x, s.y - 8);
      ctx.font = `${Math.max(9, 11 * cam.zoom)}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
      ctx.fillText(badge.title, s.x, s.y + 8);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      ctx.fillText(badge.subtitle, s.x, s.y + 22);
    }

    // Selection highlight (drawn on the tile, under entities).
    // Yellow = free buildable tile, red = occupied, gray = locked land.
    if (this.selected) {
      const buildable = isBuildableTile(this.def, this.selected.col, this.selected.row);
      const taken = buildable && this.isOccupied(this.selected.col, this.selected.row);
      const c = tileToWorld(this.iso, this.selected.col, this.selected.row);
      const s = toScreen(c.x, c.y);
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - zy);
      ctx.lineTo(s.x + zx, s.y);
      ctx.lineTo(s.x, s.y + zy);
      ctx.lineTo(s.x - zx, s.y);
      ctx.closePath();
      ctx.fillStyle = !buildable ? SELECT_LOCKED_FILL : taken ? SELECT_TAKEN_FILL : SELECT_FILL;
      ctx.fill();
      ctx.strokeStyle = !buildable ? SELECT_LOCKED_EDGE : taken ? SELECT_TAKEN_EDGE : SELECT_EDGE;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Entities (trees + buildings) in depth order. Buildings sit on tiles,
    // so occupied tiles skip their decorative tree.
    const now = performance.now();
    let stillFresh = false;
    interface Entity {
      depth: number;
      kind: 'tree' | 'building';
      col: number;
      row: number;
      type?: string;
      id?: string;
      level?: number;
    }
    const entities: Entity[] = [];
    for (const d of this.def.decor) {
      if (this.isOccupied(d.col, d.row)) continue;
      entities.push({ depth: d.col + d.row, kind: 'tree', col: d.col, row: d.row });
    }
    for (const b of this.buildings) {
      entities.push({ depth: b.x + b.y + 0.5, kind: 'building', col: b.x, row: b.y, type: b.type, id: b.id, level: b.level });
    }
    entities.sort((a, b) => a.depth - b.depth);

    for (const e of entities) {
      const c = tileToWorld(this.iso, e.col, e.row);
      const s = toScreen(c.x, c.y);
      if (s.x < -60 || s.x > cssW + 60 || s.y < -90 || s.y > cssH + 90) continue;
      const u = cam.zoom; // scale unit
      if (e.kind === 'tree') {
        ctx.fillStyle = '#92400e';
        ctx.fillRect(s.x - 2.5 * u, s.y - 6 * u, 5 * u, 10 * u);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.arc(s.x, s.y - 12 * u, 9 * u, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.arc(s.x - 3 * u, s.y - 15 * u, 5 * u, 0, Math.PI * 2);
        ctx.fill();
      } else {
        let scale = 1;
        const born = this.fresh.get(e.id ?? '');
        if (born !== undefined) {
          const t = (now - born) / POP_MS;
          if (t >= 1) {
            this.fresh.delete(e.id ?? '');
          } else {
            scale = Math.max(0.01, easeOutBack(Math.max(0, t)));
            stillFresh = true;
          }
        }
        paintBuilding(ctx, e.type ?? '', s.x, s.y, zx, zy, u * scale, e.level ?? 1);
      }
    }
    if (!stillFresh && this.fresh.size > 0) {
      // All animations finished (e.g. tab was hidden); drop stale stamps.
      this.fresh.clear();
    }

    ctx.restore();
  }
}
