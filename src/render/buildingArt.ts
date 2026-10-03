/**
 * Placeholder building art — simple billboard sprites drawn with canvas shapes.
 * Each painter draws one building type anchored at the tile center (sx, sy),
 * scaled by s (camera zoom x pop-in scale). Level adds visible extras
 * (floors, trim, gold accents). Real art assets replace these painters later
 * without touching the renderer loop or game logic. No economy values here.
 */

export function paintBuilding(
  ctx: CanvasRenderingContext2D,
  type: string,
  sx: number,
  sy: number,
  zx: number,
  zy: number,
  s: number,
  level = 1
): void {
  const lvl = Math.min(3, Math.max(1, Math.floor(level)));
  switch (type) {
    case 'house':
      paintHouse(ctx, sx, sy, s, lvl);
      break;
    case 'apartment':
      paintApartment(ctx, sx, sy, s, lvl);
      break;
    case 'park':
      paintPark(ctx, sx, sy, zx, zy, s, lvl);
      break;
    case 'shop':
      paintShop(ctx, sx, sy, s, lvl);
      break;
    case 'school':
      paintSchool(ctx, sx, sy, s, lvl);
      break;
    case 'clinic':
      paintClinic(ctx, sx, sy, s, lvl);
      break;
    case 'market':
      paintMarket(ctx, sx, sy, s, lvl);
      break;
    case 'hospital':
      paintHospital(ctx, sx, sy, s, lvl);
      break;
    case 'college':
      paintCollege(ctx, sx, sy, s, lvl);
      break;
    case 'highrise':
      paintHighrise(ctx, sx, sy, s, lvl);
      break;
    case 'landmark':
      paintLandmark(ctx, sx, sy, s, lvl);
      break;
    default:
      paintUnknown(ctx, sx, sy, s);
      break;
  }
}

/** Gold trim drawn on upgraded (L2+) buildings. */
function paintStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(x, y, 3 * s, 0, Math.PI * 2);
  ctx.fill();
}

function paintHouse(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  // Walls
  ctx.fillStyle = '#fef3c7';
  ctx.fillRect(x - 14 * s, y - 8 * s - 14 * s, 28 * s, 22 * s);
  // Roof (taller + gold ridge at L3)
  ctx.fillStyle = lvl >= 3 ? '#f59e0b' : '#ef4444';
  ctx.beginPath();
  ctx.moveTo(x - 17 * s, y - 8 * s);
  ctx.lineTo(x, y - (24 + (lvl - 1) * 4) * s);
  ctx.lineTo(x + 17 * s, y - 8 * s);
  ctx.closePath();
  ctx.fill();
  // Door + window
  ctx.fillStyle = '#92400e';
  ctx.fillRect(x - 4 * s, y - 8 * s, 8 * s, 8 * s);
  ctx.fillStyle = '#93c5fd';
  ctx.fillRect(x + 5 * s, y - 14 * s, 6 * s, 6 * s);
  // L2+: chimney; L3: second window + star
  if (lvl >= 2) {
    ctx.fillStyle = '#78716c';
    ctx.fillRect(x + 8 * s, y - 26 * s, 5 * s, 10 * s);
  }
  if (lvl >= 3) {
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(x - 11 * s, y - 14 * s, 6 * s, 6 * s);
    paintStar(ctx, x, y - 30 * s, s);
  }
}

function paintApartment(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  const rows = 3 + (lvl - 1); // L1:3 L2:4 L3:5 window rows = extra floors
  const top = 44 + (lvl - 1) * 14;
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(x - 16 * s, y - 8 * s - top * s, 32 * s, (top + 8) * s);
  ctx.fillStyle = lvl >= 3 ? '#fbbf24' : '#64748b';
  ctx.fillRect(x - 16 * s, y - 8 * s - (top + 4) * s, 32 * s, 4 * s);
  ctx.fillStyle = '#fde68a';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillRect(x - 11 * s + c * 13 * s, y - 8 * s - (top - 4) * s + r * 14 * s, 8 * s, 9 * s);
    }
  }
}

function paintPark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  zx: number,
  zy: number,
  s: number,
  lvl: number
): void {
  // Lawn inset following the tile diamond.
  ctx.beginPath();
  ctx.moveTo(x, y - zy * 0.72);
  ctx.lineTo(x + zx * 0.72, y);
  ctx.lineTo(x, y + zy * 0.72);
  ctx.lineTo(x - zx * 0.72, y);
  ctx.closePath();
  ctx.fillStyle = '#4ade80';
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.stroke();
  // Tree + flowers
  ctx.fillStyle = '#92400e';
  ctx.fillRect(x - 2 * s, y - 4 * s - 8 * s, 4 * s, 12 * s);
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.arc(x, y - 4 * s - 12 * s, 8 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.arc(x - 12 * s, y + 2 * s, 2.2 * s, 0, Math.PI * 2);
  ctx.arc(x + 11 * s, y + 3 * s, 2.2 * s, 0, Math.PI * 2);
  ctx.fill();
  // L2+: second tree; L3: pond + star
  if (lvl >= 2) {
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x + 12 * s, y - 6 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lvl >= 3) {
    ctx.fillStyle = '#7dd3fc';
    ctx.beginPath();
    ctx.ellipse(x - 4 * s, y + 4 * s, 7 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    paintStar(ctx, x, y - 20 * s, s);
  }
}

function paintShop(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  ctx.fillStyle = '#fed7aa';
  ctx.fillRect(x - 20 * s, y - 8 * s - 18 * s, 40 * s, 26 * s);
  // Striped awning
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#f8fafc';
    ctx.fillRect(x - 20 * s + i * 8 * s, y - 8 * s - 26 * s, 8 * s, 8 * s);
  }
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(x - 20 * s, y - 8 * s - 18 * s, 40 * s, 3 * s);
  // Door + sign dot
  ctx.fillStyle = '#9a3412';
  ctx.fillRect(x - 5 * s, y - 8 * s, 10 * s, 8 * s);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(x + 12 * s, y - 8 * s - 22 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  // L2+: side window + taller sign; L3: gold awning edge + star
  if (lvl >= 2) {
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(x - 18 * s, y - 8 * s - 14 * s, 7 * s, 7 * s);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(x + 12 * s, y - 8 * s - 22 * s, (3 + (lvl - 1)) * s, 0, Math.PI * 2);
    ctx.fill();
  }
  if (lvl >= 3) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x - 20 * s, y - 8 * s - 18 * s, 40 * s, 2 * s);
    paintStar(ctx, x - 14 * s, y - 8 * s - 30 * s, s);
  }
}

function paintSchool(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  // Brick schoolhouse with bell gable and flag.
  ctx.fillStyle = '#fca5a5';
  ctx.fillRect(x - 18 * s, y - 8 * s - 20 * s, 36 * s, 28 * s);
  ctx.fillStyle = '#991b1b';
  ctx.beginPath();
  ctx.moveTo(x - 18 * s, y - 8 * s - 20 * s);
  ctx.lineTo(x, y - 8 * s - 32 * s);
  ctx.lineTo(x + 18 * s, y - 8 * s - 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x - 4 * s, y - 8 * s, 8 * s, 8 * s);
  ctx.fillRect(x - 14 * s, y - 8 * s - 16 * s, 7 * s, 7 * s);
  ctx.fillRect(x + 7 * s, y - 8 * s - 16 * s, 7 * s, 7 * s);
  // Flag pole + pennant.
  ctx.fillStyle = '#78350f';
  ctx.fillRect(x + 14 * s, y - 8 * s - 40 * s, 2 * s, 12 * s);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(x + 16 * s, y - 8 * s - 40 * s);
  ctx.lineTo(x + 24 * s, y - 8 * s - 37 * s);
  ctx.lineTo(x + 16 * s, y - 8 * s - 34 * s);
  ctx.closePath();
  ctx.fill();
  // L2+: side wing; L3: gold bell + star
  if (lvl >= 2) {
    ctx.fillStyle = '#fecaca';
    ctx.fillRect(x + 18 * s, y - 8 * s - 12 * s, 10 * s, 12 * s);
  }
  if (lvl >= 3) {
    paintStar(ctx, x, y - 8 * s - 36 * s, s);
  }
}

function paintClinic(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  const extra = (lvl - 1) * 10; // taller block per level
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(x - 16 * s, y - 8 * s - 24 * s - extra * s, 32 * s, (32 + extra) * s);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.strokeRect(x - 16 * s, y - 8 * s - 24 * s - extra * s, 32 * s, (32 + extra) * s);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x - 3 * s, y - 8 * s - 20 * s, 6 * s, 16 * s);
  ctx.fillRect(x - 8 * s, y - 8 * s - 15 * s, 16 * s, 6 * s);
  ctx.fillStyle = lvl >= 3 ? '#fbbf24' : '#94a3b8';
  ctx.fillRect(x - 16 * s, y - 8 * s - 28 * s - extra * s, 32 * s, 4 * s);
  if (lvl >= 2) {
    ctx.fillStyle = '#93c5fd';
    ctx.fillRect(x - 12 * s, y - 8 * s - 24 * s - extra * s + 4 * s, 6 * s, 6 * s);
    ctx.fillRect(x + 6 * s, y - 8 * s - 24 * s - extra * s + 4 * s, 6 * s, 6 * s);
  }
}

function paintUnknown(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#a78bfa';
  ctx.fillRect(x - 10 * s, y - 8 * s - 10 * s, 20 * s, 18 * s);
}

function paintMarket(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  // Grand bazaar: wide hall, double awning, lanterns per level.
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(x - 22 * s, y - 8 * s - 20 * s, 44 * s, 28 * s);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#f8fafc';
    ctx.fillRect(x - 22 * s + i * 7.5 * s, y - 8 * s - 28 * s, 7.5 * s, 8 * s);
  }
  ctx.fillStyle = '#9a3412';
  ctx.fillRect(x - 22 * s, y - 8 * s - 20 * s, 44 * s, 3 * s);
  ctx.fillRect(x - 5 * s, y - 8 * s, 10 * s, 8 * s);
  for (let l = 0; l < lvl; l++) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(x - 12 * s + l * 12 * s, y - 8 * s - 32 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintHospital(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  // Tall white tower with red cross, extra wings per level.
  const extra = (lvl - 1) * 12;
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(x - 16 * s, y - 8 * s - 40 * s - extra * s, 32 * s, (48 + extra) * s);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = Math.max(1, 1.5 * s);
  ctx.strokeRect(x - 16 * s, y - 8 * s - 40 * s - extra * s, 32 * s, (48 + extra) * s);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(x - 4 * s, y - 8 * s - 36 * s, 8 * s, 22 * s);
  ctx.fillRect(x - 11 * s, y - 8 * s - 29 * s, 22 * s, 8 * s);
  ctx.fillStyle = '#93c5fd';
  for (let r = 0; r < 2 + (lvl - 1); r++) {
    ctx.fillRect(x - 12 * s, y - 8 * s - 20 * s + r * 9 * s, 6 * s, 5 * s);
    ctx.fillRect(x + 6 * s, y - 8 * s - 20 * s + r * 9 * s, 6 * s, 5 * s);
  }
}

function paintCollege(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  // Classical hall with columns and a dome that grows per level.
  ctx.fillStyle = '#e7e5e4';
  ctx.fillRect(x - 20 * s, y - 8 * s - 22 * s, 40 * s, 30 * s);
  ctx.fillStyle = '#a8a29e';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - 17 * s + i * 10 * s, y - 8 * s - 22 * s, 4 * s, 30 * s);
  }
  ctx.fillStyle = lvl >= 3 ? '#fbbf24' : '#78716c';
  ctx.beginPath();
  ctx.arc(x, y - 8 * s - 22 * s, (8 + (lvl - 1) * 3) * s, Math.PI, 0);
  ctx.fill();
  if (lvl >= 2) paintStar(ctx, x, y - 8 * s - 36 * s, s);
}

function paintHighrise(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  // Glass tower: rises with level, lit windows, gold crown at L3.
  const floors = 5 + (lvl - 1) * 2;
  const h = floors * 11;
  const grad = ctx.createLinearGradient(x - 14 * s, 0, x + 14 * s, 0);
  grad.addColorStop(0, '#7dd3fc');
  grad.addColorStop(0.5, '#e0f2fe');
  grad.addColorStop(1, '#7dd3fc');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 14 * s, y - 8 * s - h * s, 28 * s, (h + 8) * s);
  ctx.fillStyle = '#fef9c3';
  for (let r = 0; r < floors; r++) {
    for (let c = 0; c < 2; c++) {
      ctx.fillRect(x - 10 * s + c * 11 * s, y - 8 * s - (h - 4) * s + r * 11 * s, 7 * s, 6 * s);
    }
  }
  if (lvl >= 3) {
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x - 14 * s, y - 8 * s - (h + 4) * s, 28 * s, 4 * s);
  }
}

function paintLandmark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lvl: number): void {
  // Golden obelisk on a stepped plaza pedestal, rings per level.
  ctx.fillStyle = '#d6d3d1';
  ctx.fillRect(x - 18 * s, y - 4 * s, 36 * s, 4 * s);
  ctx.fillRect(x - 14 * s, y - 8 * s, 28 * s, 4 * s);
  const ob = lvl >= 2 ? 1.25 : 1;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(x - 7 * s * ob, y - 8 * s);
  ctx.lineTo(x - 4 * s * ob, y - 8 * s - 34 * s * ob);
  ctx.lineTo(x + 4 * s * ob, y - 8 * s - 34 * s * ob);
  ctx.lineTo(x + 7 * s * ob, y - 8 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fffbeb';
  ctx.beginPath();
  ctx.arc(x, y - 8 * s - 38 * s * ob, 3 * s, 0, Math.PI * 2);
  ctx.fill();
  if (lvl >= 3) paintStar(ctx, x, y - 8 * s - 46 * s, s);
}
