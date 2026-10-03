import type { GameStore } from '../game/state/store';
import { isBuildableTile, type TileCoord } from '../game/map/types';
import {
  buildMapDef,
  buildableTileCount,
  coreWorldBounds,
  zoneAtTile,
  zoneBadgeWorld,
  type TileZone
} from '../game/map/expansion';
import { EXPANSIONS } from '../game/data/expansions';
import { purchaseExpansion, EXPANSION_MESSAGES } from '../game/map/purchase';
import { BUILDINGS, BUILDING_ICONS, getBuildingDef, serviceSummary } from '../game/data/buildings';
import { formatCoins } from '../game/data/economy';
import { NEEDS, NEED_LABELS, totalServiceCapacity, coverageMap } from '../game/needs/services';
import { satisfactionBand } from '../game/needs/satisfaction';
import { constructBuilding, CONSTRUCT_MESSAGES, isTileOccupied, constructionCostFor } from '../game/buildings/construction';
import { techModifiersFor } from '../game/progression/technology';
import { upgradeBuilding, UPGRADE_MESSAGES, upgradeCostFor } from '../game/buildings/upgrades';
import { effectiveStats } from '../game/buildings/stats';
import { economySummary } from '../game/economy/maintenance';
import { getStageForPopulation, nextStage, stageIndex } from '../game/progression/stages';
import { getStageDef } from '../game/data/stages';
import { unlockStatusForStage } from '../game/progression/unlocks';
import { TECHS, getTechDef, techEffectSummary } from '../game/data/technologies';
import { availableTechs, researchTechnology, RESEARCH_MESSAGES } from '../game/progression/technology';
import { advanceGame } from '../game/sim/tick';
import { IsoMapRenderer } from '../render/isoMapRenderer';
import { cityService } from '../services/cityService';
import { getSupabase } from '../services/supabaseClient';
import { loadLocal, saveLocal } from '../lib/localSave';
import { logger } from '../lib/logger';

/**
 * Build the main game UI and return UI state for external management
 */
export function buildGameUI(app: HTMLElement, store: GameStore): {
  mapDef: ReturnType<typeof buildMapDef>;
  renderer: IsoMapRenderer;
  sheetMode: 'build' | 'upgrade' | null;
  lastAffordSig: string;
  lastUpgradeSig: string;
  lastExpandSig: string;
  lastMapSig: string;
  lastHighest: string;
  lastCoins: number | null;
  lastPop: number | null;
} {
  app.innerHTML = '';
  app.className = 'phone';

  const top = document.createElement('header');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="stat stat-coins" data-testid="stat-coins" role="button" tabindex="0" title="City economy — tap for details">💰 <span>—</span><small class="income-rate" data-testid="income-rate"></small></div>
    <div class="stat" data-testid="stat-pop">👥 <span>—</span></div>
    <div class="stat stat-happy" data-testid="stat-happy" role="button" tabindex="0" title="City satisfaction — tap for details">😊 <span>—</span></div>
    <div class="sync" data-testid="sync-status" title="Cloud status">○ offline</div>
    <button id="signout-btn" class="signout-btn" title="Sign out">⎋</button>
  `;

  const main = document.createElement('main');
  main.className = 'map-area';
  main.setAttribute('data-testid', 'map-area');

  const chip = document.createElement('div');
  chip.className = 'tile-chip';
  chip.setAttribute('data-testid', 'tile-chip');
  chip.textContent = 'Tap a tile';
  main.appendChild(chip);

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('data-testid', 'toast');
  toast.hidden = true;
  main.appendChild(toast);
  let toastTimer = 0;
  const showToast = (msg: string) => {
    toast.textContent = msg;
    toast.hidden = false;
    toast.classList.remove('show');
    void toast.offsetWidth;
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2200);
  };

  const bottom = document.createElement('nav');
  bottom.className = 'bottomnav';
  bottom.innerHTML = `
    <button data-testid="nav-build">🏗️<small>Build</small></button>
    <button data-testid="nav-upgrade">⬆️<small>Upgrade</small></button>
    <button data-testid="nav-expand">🗺️<small>Expand</small></button>
    <button disabled title="Phase 11+">🎯<small>Goals</small></button>
  `;

  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  backdrop.hidden = true;

  const sheet = document.createElement('section');
  sheet.className = 'sheet';
  sheet.setAttribute('data-testid', 'build-sheet');
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="sheet-head">
      <strong>Build</strong>
      <button class="sheet-close" data-testid="sheet-close" aria-label="Close build menu">✕</button>
    </div>
    <p class="sheet-hint">Tap a tile, then pick a building.</p>
    <div class="build-list" data-testid="build-list"></div>
  `;

  const needsSheet = document.createElement('section');
  needsSheet.className = 'sheet';
  needsSheet.setAttribute('data-testid', 'needs-sheet');
  needsSheet.hidden = true;
  needsSheet.innerHTML = `
    <div class="sheet-head">
      <strong>City satisfaction</strong>
      <button class="sheet-close" data-testid="needs-close" aria-label="Close satisfaction details">✕</button>
    </div>
    <p class="sheet-hint">Each citizen needs care, learning and play. Low bars = build that service.</p>
    <div class="needs-list" data-testid="needs-list"></div>
  `;

  const econSheet = document.createElement('section');
  econSheet.className = 'sheet';
  econSheet.setAttribute('data-testid', 'econ-sheet');
  econSheet.hidden = true;
  econSheet.innerHTML = `
    <div class="sheet-head">
      <strong>City economy</strong>
      <button class="sheet-close" data-testid="econ-close" aria-label="Close economy details">✕</button>
    </div>
    <p class="sheet-hint">Citizens pay taxes, shops earn, buildings cost upkeep.</p>
    <div class="needs-list" data-testid="econ-list"></div>
  `;

  const progSheet = document.createElement('section');
  progSheet.className = 'sheet';
  progSheet.setAttribute('data-testid', 'prog-sheet');
  progSheet.hidden = true;
  progSheet.innerHTML = `
    <div class="sheet-head">
      <strong>City progress</strong>
      <button class="sheet-close" data-testid="prog-close" aria-label="Close progression details">✕</button>
    </div>
    <p class="sheet-hint">Grow population to reach new eras and unlock buildings.</p>
    <div class="needs-list" data-testid="prog-list"></div>
  `;

  const expandSheet = document.createElement('section');
  expandSheet.className = 'sheet';
  expandSheet.setAttribute('data-testid', 'expand-sheet');
  expandSheet.hidden = true;
  expandSheet.innerHTML = `
    <div class="sheet-head">
      <strong>Expand city</strong>
      <button class="sheet-close" data-testid="expand-close" aria-label="Close expansion menu">✕</button>
    </div>
    <p class="sheet-hint">Buy surrounding land to make room for a bigger city.</p>
    <div class="needs-list" data-testid="expand-list"></div>
  `;

  main.className = 'map-area';
  main.setAttribute('data-testid', 'map-area');

  const phase = document.createElement('p');
  phase.className = 'phase-note';
  phase.textContent = 'Phase 10 — buy land, grow outward.';

  const mapDef = buildMapDef([]);

  app.append(top, main, bottom, backdrop, sheet, needsSheet, econSheet, progSheet, expandSheet);
  app.appendChild(phase);

  const renderer = new IsoMapRenderer(buildMapDef([]), {
    onSelect: (tile) => { /* refreshChip(tile) */ }
  });
  renderer.mount(document.querySelector('main.map-area')!, coreWorldBounds());

  return {
    mapDef: buildMapDef([]),
    renderer: new IsoMapRenderer(buildMapDef([]), { onSelect: () => {} }),
    sheetMode: null,
    lastAffordSig: '',
    lastUpgradeSig: '',
    lastExpandSig: '',
    lastMapSig: '',
    lastHighest: '',
    lastCoins: null,
    lastPop: null,
  };
}
