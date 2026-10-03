/**
 * Mobile-first camera: drag-pan, pinch-zoom, wheel-zoom (desktop), tap detect.
 * World point under the gesture anchor stays fixed while zooming.
 * Camera target is clamped so the map cannot be lost off-screen.
 */

export interface CameraState {
  /** World coords at the viewport center. */
  x: number;
  y: number;
  zoom: number;
}

export interface CameraBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CameraOptions {
  minZoom: number;
  maxZoom: number;
  /** Extra world-unit margin allowed beyond the map bounds. */
  margin: number;
  onChange: () => void;
  onTap?: (screenX: number, screenY: number) => void;
}

const TAP_MAX_PX = 8;
const TAP_MAX_MS = 400;

export class Camera {
  private state: CameraState;
  private bounds: CameraBounds;
  private opts: CameraOptions;
  private el: HTMLElement | null = null;
  private viewW = 1;
  private viewH = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { dist: number; zoom: number } | null = null;
  private downAt = 0;
  private moved = 0;
  private cleanup: (() => void)[] = [];

  constructor(initial: CameraState, bounds: CameraBounds, opts: CameraOptions) {
    this.state = { ...initial };
    this.bounds = bounds;
    this.opts = opts;
    this.clamp();
  }

  get snapshot(): CameraState {
    return { ...this.state };
  }

  setBounds(b: CameraBounds): void {
    this.bounds = b;
    this.clamp();
  }

  setViewport(w: number, h: number): void {
    this.viewW = Math.max(1, w);
    this.viewH = Math.max(1, h);
    this.clamp();
  }

  /**
   * Fit the camera bounds (default) or an explicit rect (e.g. the settled
   * core on first load) into the viewport; returns the zoom used.
   * Clamping still uses the full camera bounds afterwards.
   */
  fitToBounds(padPx = 24, fit?: CameraBounds): number {
    const b = fit ?? this.bounds;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const z = Math.min(this.viewW / (w + padPx * 2), this.viewH / (h + padPx * 2));
    this.state.zoom = this.clampZoom(z);
    this.state.x = (b.minX + b.maxX) / 2;
    this.state.y = (b.minY + b.maxY) / 2;
    this.clamp();
    this.opts.onChange();
    return this.state.zoom;
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.state.x) * this.state.zoom + this.viewW / 2,
      y: (wy - this.state.y) * this.state.zoom + this.viewH / 2
    };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewW / 2) / this.state.zoom + this.state.x,
      y: (sy - this.viewH / 2) / this.state.zoom + this.state.y
    };
  }

  zoomAround(sx: number, sy: number, nextZoom: number): void {
    const before = this.screenToWorld(sx, sy);
    this.state.zoom = this.clampZoom(nextZoom);
    const after = this.screenToWorld(sx, sy);
    this.state.x += before.x - after.x;
    this.state.y += before.y - after.y;
    this.clamp();
    this.opts.onChange();
  }

  attach(el: HTMLElement): void {
    this.el = el;
    const onPointerDown = (e: PointerEvent) => {
      el.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) {
        this.downAt = performance.now();
        this.moved = 0;
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.state.zoom };
        this.moved = Number.POSITIVE_INFINITY; // a pinch is never a tap
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.moved += Math.abs(dx) + Math.abs(dy);

      if (this.pointers.size === 1) {
        this.state.x -= dx / this.state.zoom;
        this.state.y -= dy / this.state.zoom;
        this.clamp();
        this.opts.onChange();
      } else if (this.pointers.size === 2 && this.pinchStart) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist > 0 && this.pinchStart.dist > 0) {
          const rect = el.getBoundingClientRect();
          const midX = (a.x + b.x) / 2 - rect.left;
          const midY = (a.y + b.y) / 2 - rect.top;
          this.zoomAround(midX, midY, this.pinchStart.zoom * (dist / this.pinchStart.dist));
        }
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      const wasSingle = this.pointers.size === 1;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchStart = null;
      if (wasSingle && this.opts.onTap) {
        const dt = performance.now() - this.downAt;
        if (this.moved <= TAP_MAX_PX && dt <= TAP_MAX_MS) {
          const rect = el.getBoundingClientRect();
          this.opts.onTap(e.clientX - rect.left, e.clientY - rect.top);
        }
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      this.zoomAround(e.clientX - rect.left, e.clientY - rect.top, this.state.zoom * Math.exp(-e.deltaY * 0.0012));
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    this.cleanup = [
      () => el.removeEventListener('pointerdown', onPointerDown),
      () => el.removeEventListener('pointermove', onPointerMove),
      () => el.removeEventListener('pointerup', onPointerUp),
      () => el.removeEventListener('pointercancel', onPointerUp),
      () => el.removeEventListener('wheel', onWheel)
    ];
  }

  detach(): void {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.pointers.clear();
    this.el = null;
  }

  private clampZoom(z: number): number {
    return Math.min(this.opts.maxZoom, Math.max(this.opts.minZoom, z));
  }

  private clamp(): void {
    const m = this.opts.margin;
    // Allow the viewport to show at most half a screen of void beyond the map.
    const slackX = this.viewW / 2 / this.state.zoom + m;
    const slackY = this.viewH / 2 / this.state.zoom + m;
    // Symmetric clamp around the map center:
    const cx = (this.bounds.minX + this.bounds.maxX) / 2;
    const cy = (this.bounds.minY + this.bounds.maxY) / 2;
    const halfSpanX = (this.bounds.maxX - this.bounds.minX) / 2 + slackX;
    const halfSpanY = (this.bounds.maxY - this.bounds.minY) / 2 + slackY;
    this.state.x = Math.min(Math.max(this.state.x, cx - halfSpanX), cx + halfSpanX);
    this.state.y = Math.min(Math.max(this.state.y, cy - halfSpanY), cy + halfSpanY);
  }
}
