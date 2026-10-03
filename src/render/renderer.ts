/**
 * Renderer contract. PixiJS (or Canvas) plugs in here in Phase 2.
 * Sim and UI must never import a concrete renderer — depend on this interface.
 */
export interface Renderer {
  mount(root: HTMLElement): void;
  resize(): void;
  dispose(): void;
}

/**
 * Phase 1 placeholder: lightweight 2D canvas with a static message.
 * Proves the mount/resize/dispose lifecycle + DPR capping for mobile perf.
 */
export class PlaceholderRenderer implements Renderer {
  private canvas: HTMLCanvasElement | null = null;
  private ro: ResizeObserver | null = null;

  mount(root: HTMLElement): void {
    const canvas = document.createElement('canvas');
    canvas.className = 'map-canvas';
    canvas.setAttribute('aria-label', 'City map placeholder');
    root.appendChild(canvas);
    this.canvas = canvas;
    this.resize();
    this.paint();

    this.ro = new ResizeObserver(() => {
      this.resize();
      this.paint();
    });
    this.ro.observe(root);
  }

  resize(): void {
    if (!this.canvas || !this.canvas.parentElement) return;
    const parent = this.canvas.parentElement;
    const rect = parent.getBoundingClientRect();
    // Cap DPR at 2 for low-end mobile GPUs (perf principle).
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  dispose(): void {
    this.ro?.disconnect();
    this.ro = null;
    this.canvas?.remove();
    this.canvas = null;
  }

  private paint(): void {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = this.canvas;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#86efac');
    grad.addColorStop(1, '#bbf7d0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#065f46';
    ctx.font = `${Math.max(14, width / 22)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('🏙️ Map arrives in Phase 2', width / 2, height / 2);
  }
}
