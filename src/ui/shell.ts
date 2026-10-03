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

/**
 * Mobile-first app shell: top HUD / map area / bottom nav + Phase-3 build
 * sheet and toast. The shell is thin: taps become constructBuilding() calls
 * on the central store; renderer and persistence follow via subscriptions.
 */
export function buildShell(app: HTMLElement, store: GameStore): void {
  app.innerHTML = '';
  app.className = 'phone';

  const top = document.createElement('header');
  top.className = 'topbar';
  top.innerHTML = `
    <div class="stat stat-coins" data-testid="stat-coins" role="button" tabindex="0" title="City economy — tap for details">💰 <span>—</span><small class="income-rate" data-testid="income-rate"></small></div>
    <div class="stat" data-testid="stat-pop">👥 <span>—</span></div>
    <div class="stat stat-happy" data-testid="stat-happy" role="button" tabindex="0" title="City satisfaction — tap for details">😊 <span>—</span></div>
    <div class="sync" data-testid="sync-status" title="Cloud status">○ offline</div>
  `;
  const coinsSpan = top.querySelector('[data-testid="stat-coins"] span') as HTMLElement;
  const coinsBox = top.querySelector('[data-testid="stat-coins"]') as HTMLElement;
  const incomeRate = top.querySelector('[data-testid="income-rate"]') as HTMLElement;
  const popBox = top.querySelector('[data-testid="stat-pop"]') as HTMLElement;
  const popSpan = top.querySelector('[data-testid="stat-pop"] span') as HTMLElement;
  const happyBox = top.querySelector('[data-testid="stat-happy"]') as HTMLElement;
  const happySpan = top.querySelector('[data-testid="stat-happy"] span') as HTMLElement;

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
    void toast.offsetWidth; // restart animation
    toast.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 2200);
  };

  const bottom = document.createElement('nav');
  bottom.className = 'bottomnav';
  bottom.innerHTML = `
    <button data-testid="nav-build">🏗️<small>Build</small></button>
    <button data-testid="nav-upgrade">⬆️<small>Upgrade</small></button>
    <button data-testid="nav-expand">🗺️<small>Expand</small></button>
    <button disabled title="Phase 11+">🎯<small>Goals</small></button>
  `;

  // Bottom sheet (build menu).
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
  const buildList = sheet.querySelector('[data-testid="build-list"]') as HTMLElement;
  const sheetTitle = sheet.querySelector('.sheet-head strong') as HTMLElement;
  const sheetHint = sheet.querySelector('.sheet-hint') as HTMLElement;
  /** Which menu the shared bottom sheet currently shows. */
  let sheetMode: 'build' | 'upgrade' | null = null;

  // Satisfaction breakdown sheet (reuses .sheet styling).
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
  const needsList = needsSheet.querySelector('[data-testid="needs-list"]') as HTMLElement;

  // Economy breakdown sheet (same pattern: income, upkeep, net).
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
  const econList = econSheet.querySelector('[data-testid="econ-list"]') as HTMLElement;

  // Progression sheet: stage, milestones, unlocks, research.
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
  const progList = progSheet.querySelector('[data-testid="prog-list"]') as HTMLElement;

  // Expansion sheet: purchased land + available/locked zones.
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
  const expandList = expandSheet.querySelector('[data-testid="expand-list"]') as HTMLElement;
  app.append(top, main, bottom, backdrop, sheet, needsSheet, econSheet, progSheet, expandSheet);

  // Slim stage bar under the HUD: current era + progress to next. Tappable.
  const stageBar = document.createElement('button');
  stageBar.className = 'stagebar';
  stageBar.setAttribute('data-testid', 'stage-bar');
  stageBar.setAttribute('title', 'City progress — tap for details');
  app.insertBefore(stageBar, main);

  const phase = document.createElement('p');
  phase.className = 'phase-note';
  phase.textContent = 'Phase 10 — buy land, grow outward.';
  app.appendChild(phase);

  // Living map definition: core + purchased expansions. Rebuilt only when
  // the unlocked set changes (tracked in sync); construction, chips and
  // rendering all read this single object.
  let mapDef = buildMapDef(store.get().map.unlockedExpansionIds);

  const zoneBadges = () => {
    const owned = new Set(store.get().map.unlockedExpansionIds);
    return EXPANSIONS.filter((e) => !owned.has(e.id)).map((e) => {
      const anchor = zoneBadgeWorld(e);
      return { x: anchor.x, y: anchor.y, icon: '🔒', title: e.name, subtitle: formatCoins(e.cost) };
    });
  };

  const renderer = new IsoMapRenderer(mapDef, {
    onSelect: (tile) => refreshChip(tile)
  });
  renderer.mount(main, coreWorldBounds());
  renderer.setMapDef(mapDef, zoneBadges());

  const refreshChip = (tile: TileCoord | null) => {
    if (!tile) {
      chip.textContent = 'Tap a tile';
      return;
    }
    if (isTileOccupied(store.get(), tile)) {
      const existing = store.get().buildings.find((b) => b.x === tile.col && b.y === tile.row);
      const def = existing ? getBuildingDef(existing.type) : undefined;
      const name = def?.name ?? existing?.type ?? 'Building';
      const lvl = existing ? ` Lv${existing.level}` : '';
      const svc = def ? serviceSummary(def) : null;
      chip.textContent = `${BUILDING_ICONS[existing?.type ?? ''] ?? '🏢'} ${name}${lvl}${svc ? ` • ${svc}` : ''} — tap Upgrade`;
      return;
    }
    if (!isBuildableTile(mapDef, tile.col, tile.row)) {
      const zone: TileZone = zoneAtTile(tile.col, tile.row, store.get().map.unlockedExpansionIds);
      if (zone.kind === 'zone') {
        chip.textContent = `🔒 ${zone.expansion.name} · ${formatCoins(zone.expansion.cost)} — tap Expand`;
      } else {
        chip.textContent = 'Locked terrain';
      }
      return;
    }
    chip.textContent = `Tile ${tile.col}, ${tile.row} • tap Build`;
  };

  const renderBuildList = (coins: number) => {
    sheetTitle.textContent = 'Build';
    sheetHint.textContent = 'Tap a tile, then pick a building.';
    buildList.innerHTML = '';
    const highest = store.get().progress.highestStageId;
    const discount = techModifiersFor(store.get().technologies.unlocked).costDiscount;
    const priceOf = (defId: string) => {
      const d = getBuildingDef(defId);
      return d ? constructionCostFor(d, discount) : 0;
    };
    const locked: typeof BUILDINGS = [];
    for (const def of BUILDINGS) {
      const lock = unlockStatusForStage(def.unlockRequirement, highest);
      if (!lock.unlocked) {
        locked.push(def);
        continue;
      }
      const price = priceOf(def.id);
      const affordable = coins >= price;
      const btn = document.createElement('button');
      btn.className = 'build-card' + (affordable ? '' : ' poor');
      btn.setAttribute('data-testid', `build-${def.id}`);
      const upkeep = def.upkeepPerSec > 0 ? `<small class="build-upkeep">Upkeep −$${Math.round(def.upkeepPerSec * 60)}/min</small>` : '';
      btn.innerHTML = `
        <span class="build-icon">${BUILDING_ICONS[def.id] ?? '🏗️'}</span>
        <span class="build-meta"><strong>${def.name}</strong><small>${def.description}</small>${upkeep}</span>
        <span class="build-cost">${formatCoins(price)}</span>
      `;
      btn.addEventListener('click', () => attemptBuild(def.id));
      buildList.appendChild(btn);
    }
    // Locked buildings stay visible as goals, cheapest requirement first.
    locked.sort((a, b) => stageIndex(String(a.unlockRequirement?.stage)) - stageIndex(String(b.unlockRequirement?.stage)));
    for (const def of locked) {
      const reqId = String(def.unlockRequirement?.stage);
      const req = getStageDef(reqId);
      const card = document.createElement('button');
      card.className = 'build-card locked';
      card.setAttribute('data-testid', `build-locked-${def.id}`);
      card.innerHTML = `
        <span class="build-icon">🔒</span>
        <span class="build-meta"><strong>${def.name}</strong><small>Unlock at ${req?.name ?? reqId} · ${req?.popRequired ?? '?'} 👥</small></span>
        <span class="build-cost">${formatCoins(def.baseCost.coins)}</span>
      `;
      card.addEventListener('click', () => attemptBuild(def.id));
      buildList.appendChild(card);
    }
  };

  const attemptBuild = (defId: string) => {
    const tile = renderer.selection;
    if (!tile) {
      showToast('Tap an empty tile first');
      return;
    }
    const result = constructBuilding(store.get(), mapDef, defId, tile);
    if (!result.ok) {
      if (result.error === 'INSUFFICIENT_FUNDS') {
        showToast(`Not enough funds — need ${formatCoins(result.needed ?? 0)}`);
      } else if (result.error === 'LOCKED') {
        const def = getBuildingDef(defId);
        const reqId = String(def?.unlockRequirement?.stage ?? '');
        const req = getStageDef(reqId);
        showToast(`🔒 Unlocks at ${req?.name ?? reqId} (${req?.popRequired ?? '?'} 👥)`);
      } else {
        showToast(CONSTRUCT_MESSAGES[result.error]);
      }
      return;
    }
    store.set(result.state);
    // Refresh housing capacity immediately (dt=0: no time passes, no growth).
    const refreshed = advanceGame(result.state, 0);
    if (refreshed !== result.state) store.set(refreshed);
    const def = getBuildingDef(defId);
    showToast(`${BUILDING_ICONS[defId] ?? '🏗️'} ${def?.name ?? defId} built! (−${formatCoins(result.spent)})`);
    refreshChip(tile);
  };

  const setSheetOpen = (open: boolean) => {
    if (open) {
      setNeedsOpen(false);
      setEconOpen(false);
      setProgOpen(false);
      setExpandOpen(false);
    }
    sheet.hidden = !open;
    backdrop.hidden = !open && needsSheet.hidden && econSheet.hidden && progSheet.hidden && expandSheet.hidden;
    sheet.classList.toggle('open', open);
  };

  const setNeedsOpen = (open: boolean) => {
    if (open) {
      renderNeeds();
      setSheetOpen(false);
      setEconOpen(false);
      setProgOpen(false);
      setExpandOpen(false);
    }
    needsSheet.hidden = !open;
    backdrop.hidden = !open && sheet.hidden && econSheet.hidden && progSheet.hidden && expandSheet.hidden;
    needsSheet.classList.toggle('open', open);
  };

  const setEconOpen = (open: boolean) => {
    if (open) {
      renderEcon();
      setSheetOpen(false);
      setNeedsOpen(false);
      setProgOpen(false);
      setExpandOpen(false);
    }
    econSheet.hidden = !open;
    backdrop.hidden = !open && sheet.hidden && needsSheet.hidden && progSheet.hidden && expandSheet.hidden;
    econSheet.classList.toggle('open', open);
  };

  const setProgOpen = (open: boolean) => {
    if (open) {
      renderProgress();
      setSheetOpen(false);
      setNeedsOpen(false);
      setEconOpen(false);
      setExpandOpen(false);
    }
    progSheet.hidden = !open;
    backdrop.hidden = !open && sheet.hidden && needsSheet.hidden && econSheet.hidden && expandSheet.hidden;
    progSheet.classList.toggle('open', open);
  };

  const setExpandOpen = (open: boolean) => {
    if (open) {
      renderExpand();
      setSheetOpen(false);
      setNeedsOpen(false);
      setEconOpen(false);
      setProgOpen(false);
    }
    expandSheet.hidden = !open;
    backdrop.hidden = !open && sheet.hidden && needsSheet.hidden && econSheet.hidden && progSheet.hidden;
    expandSheet.classList.toggle('open', open);
  };

  const renderExpand = () => {
    const s = store.get();
    const coins = s.city?.coins ?? 0;
    const owned = new Set(s.map.unlockedExpansionIds);
    const highest = s.progress.highestStageId;
    expandList.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'prog-head';
    head.innerHTML = `<div class="prog-sub">Current land: <b>${buildableTileCount(mapDef)} buildable tiles</b></div>`;
    expandList.appendChild(head);

    for (const zone of EXPANSIONS) {
      const card = document.createElement('div');
      if (owned.has(zone.id)) {
        card.className = 'research-card done';
        card.innerHTML =
          `<span class="build-meta"><strong>✓ ${zone.icon} ${zone.name}</strong>` +
          `<small>${zone.w * zone.h} tiles · part of your city</small></span>`;
        expandList.appendChild(card);
        continue;
      }
      const stageOk = unlockStatusForStage({ stage: zone.requiredStage }, highest).unlocked;
      const req = getStageDef(zone.requiredStage);
      if (!stageOk) {
        card.className = 'research-card locked';
        card.innerHTML =
          `<span class="build-meta"><strong>🔒 ${zone.name}</strong>` +
          `<small>Unlock at ${req?.name ?? zone.requiredStage} · ${req?.popRequired ?? '?'} 👥</small></span>` +
          `<span class="build-cost">${formatCoins(zone.cost)}</span>`;
        expandList.appendChild(card);
        continue;
      }
      const afford = coins >= zone.cost;
      card.className = 'research-card';
      card.innerHTML =
        `<span class="build-meta"><strong>${zone.icon} ${zone.name}</strong>` +
        `<small>${zone.w * zone.h} new tiles · requires ${req?.name ?? zone.requiredStage}</small></span>` +
        `<button class="research-btn${afford ? '' : ' poor'}" data-testid="expand-${zone.id}">${formatCoins(zone.cost)}</button>`;
      (card.querySelector(`[data-testid="expand-${zone.id}"]`) as HTMLButtonElement).addEventListener('click', () => {
        const r = purchaseExpansion(store.get(), zone.id);
        if (!r.ok) {
          showToast(r.error === 'INSUFFICIENT_FUNDS'
            ? `Not enough funds — need ${formatCoins(r.needed ?? 0)}`
            : EXPANSION_MESSAGES[r.error]);
          return;
        }
        store.set(r.state);
        showToast(`🎉 ${zone.name} joined your city! +${zone.w * zone.h} tiles.`);
        lastExpandSig = '';
        renderExpand();
      });
      expandList.appendChild(card);
    }
  };

  const renderProgress = () => {
    const s = store.get();
    const pop = s.city && Number.isFinite(s.city.population) ? Math.max(0, Math.floor(s.city.population)) : 0;
    const coins = s.city?.coins ?? 0;
    const highest = s.progress.highestStageId;
    const current = getStageForPopulation(pop);
    const next = nextStage(current.id);
    progList.innerHTML = '';

    const head = document.createElement('div');
    head.className = 'prog-head';
    const pct = next ? Math.min(100, Math.round((pop / next.popRequired) * 100)) : 100;
    head.innerHTML = `
      <div class="prog-stage">${current.icon} ${current.name}</div>
      <div class="prog-sub">${next ? `👥 ${pop} / ${next.popRequired} → ${next.icon} ${next.name}` : `👥 ${pop} · Peak of civilization!`}</div>
      <div class="need-bar prog-bar"><span class="need-fill need-good" style="width:${pct}%"></span></div>
    `;
    progList.appendChild(head);

    // Unlocked buildings at highest stage reached.
    const unlockedNames = BUILDINGS.filter(
      (d) => unlockStatusForStage(d.unlockRequirement, highest).unlocked && d.unlockRequirement
    ).map((d) => `${BUILDING_ICONS[d.id] ?? '🏗️'} ${d.name}`);
    const unlockRow = document.createElement('div');
    unlockRow.className = 'prog-section';
    unlockRow.innerHTML = `<div class="prog-title">Unlocks</div><div class="prog-items">${
      unlockedNames.length > 0 ? unlockedNames.map((n) => `<span class="prog-chip">✓ ${n}</span>`).join('') : '<span class="prog-muted">Grow to Village to unlock more.</span>'
    }</div>`;
    progList.appendChild(unlockRow);

    // Research: available cards + researched checkmarks.
    const researched = s.technologies.unlocked;
    const resRow = document.createElement('div');
    resRow.className = 'prog-section';
    resRow.innerHTML = '<div class="prog-title">Research</div>';
    for (const tech of TECHS) {
      const done = researched.includes(tech.id);
      const avail = unlockStatusForStage(tech.requirement, highest).unlocked;
      const card = document.createElement('div');
      card.className = 'research-card' + (done ? ' done' : avail ? '' : ' locked');
      const effects = techEffectSummary(tech).join(' · ');
      if (done) {
        card.innerHTML = `<span class="build-meta"><strong>✓ ${tech.name}</strong><small>${effects}</small></span>`;
      } else if (avail) {
        const afford = coins >= tech.cost;
        card.innerHTML =
          `<span class="build-meta"><strong>${tech.name}</strong><small>${tech.description} ${effects}.</small></span>` +
          `<button class="research-btn${afford ? '' : ' poor'}" data-testid="research-${tech.id}">🔬 ${formatCoins(tech.cost)}</button>`;
        (card.querySelector('[data-testid="research-' + tech.id + '"]') as HTMLButtonElement).addEventListener('click', () => {
          const r = researchTechnology(store.get(), tech.id);
          if (!r.ok) {
            showToast(r.error === 'INSUFFICIENT_FUNDS'
              ? `Not enough funds — need ${formatCoins(r.needed ?? 0)}`
              : RESEARCH_MESSAGES[r.error]);
            return;
          }
          store.set(r.state);
          showToast(`🔬 ${tech.name} researched!`);
          renderProgress();
        });
      } else {
        const req = getStageDef(tech.requirement.stage);
        card.innerHTML =
          `<span class="build-meta"><strong>🔒 ${tech.name}</strong><small>Requires ${req?.name ?? tech.requirement.stage} · ${effects}</small></span>` +
          `<span class="build-cost">${formatCoins(tech.cost)}</span>`;
      }
      resRow.appendChild(card);
    }
    progList.appendChild(resRow);
  };

  const renderNeeds = () => {
    const s = store.get();
    const pop = s.city && Number.isFinite(s.city.population) ? Math.max(0, Math.floor(s.city.population)) : 0;
    const cov = coverageMap(pop, totalServiceCapacity(s.buildings));
    needsList.innerHTML = '';
    for (const need of NEEDS) {
      const pct = Math.round(cov[need] * 100);
      const row = document.createElement('div');
      row.className = 'need-row';
      row.innerHTML = `
        <span class="need-label">${NEED_LABELS[need]}</span>
        <span class="need-bar"><span class="need-fill need-${pct >= 80 ? 'good' : pct >= 50 ? 'warn' : pct >= 25 ? 'poor' : 'crit'}"></span></span>
        <span class="need-pct">${pct}%</span>
      `;
      (row.querySelector('.need-fill') as HTMLElement).style.width = `${pct}%`;
      needsList.appendChild(row);
    }
    const overall = document.createElement('div');
    overall.className = 'need-overall';
    const sat = s.city?.satisfaction ?? 0;
    overall.textContent = `Overall ${Math.round(sat * 100)}%`;
    needsList.appendChild(overall);
  };

  const money = (perMin: number) => `${perMin >= 0 ? '+' : '−'}$${Math.abs(Math.round(perMin))}/min`;

  const renderEcon = () => {
    const sum = economySummary(store.get());
    econList.innerHTML = '';
    const rows: Array<[string, string, string]> = [
      ['Population taxes', money(sum.income.taxPerMin), 'eco-pos'],
      ['Business income', money(sum.income.businessPerMin), 'eco-pos'],
      ['Building upkeep', money(-sum.maintenancePerMin), 'eco-neg']
    ];
    for (const [label, value, cls] of rows) {
      const row = document.createElement('div');
      row.className = 'need-row eco-row';
      row.innerHTML = `<span class="need-label">${label}</span><span></span><span class="need-pct ${cls}">${value}</span>`;
      econList.appendChild(row);
    }
    const net = document.createElement('div');
    net.className = 'need-overall';
    net.innerHTML = `Net <span class="${sum.netPerMin >= 0 ? 'eco-pos' : 'eco-neg'}">${money(sum.netPerMin)}</span>`;
    econList.appendChild(net);
  };

  /** Compact per-second display: $1.50/s, $0.21/s, $2/s. */
  const fmtSec = (v: number) => `$${(Math.round(v * 100) / 100).toString()}/s`;

  const renderUpgradePanel = () => {
    sheetTitle.textContent = 'Upgrade';
    sheetHint.textContent = 'Tap one of your buildings, then upgrade it.';
    buildList.innerHTML = '';
    const s = store.get();
    const coins = s.city?.coins ?? 0;
    const tile = renderer.selection;
    const b = tile ? s.buildings.find((x) => x.x === tile.col && x.y === tile.row) : undefined;
    if (!b) {
      buildList.innerHTML = '<p class="sheet-empty">Tap one of your buildings on the map first.</p>';
      return;
    }
    const def = getBuildingDef(b.type);
    if (!def) return;
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    const mods = techModifiersFor(store.get().technologies.unlocked);
    const cur = effectiveStats(b.type, b.level, mods);
    const head =
      `<span class="build-icon">${BUILDING_ICONS[b.type] ?? '🏗️'}</span>` +
      `<span class="build-meta"><strong>${def.name}</strong>` +
      `<small>Level ${b.level} / ${def.maxLevel}</small></span>`;
    if (b.level >= def.maxLevel) {
      card.innerHTML = `${head}<span class="max-badge">MAX LEVEL</span>`;
      buildList.appendChild(card);
      return;
    }
    const next = effectiveStats(b.type, b.level + 1, mods);
    const rows: string[] = [];
    if (cur.housing > 0 || next.housing > 0) rows.push(`Housing <b>${cur.housing} → ${next.housing}</b>`);
    for (const need of NEEDS) {
      if (cur.services[need] > 0 || next.services[need] > 0) {
        rows.push(`${NEED_LABELS[need]} <b>${Math.round(cur.services[need])} → ${Math.round(next.services[need])}</b>`);
      }
    }
    if (cur.incomePerSec > 0 || next.incomePerSec > 0) {
      rows.push(`Income <b>${fmtSec(cur.incomePerSec)} → ${fmtSec(next.incomePerSec)}</b>`);
    }
    if (cur.upkeepPerSec > 0 || next.upkeepPerSec > 0) {
      rows.push(`Upkeep <b>${fmtSec(cur.upkeepPerSec)} → ${fmtSec(next.upkeepPerSec)}</b>`);
    }
    const cost = upgradeCostFor(def, b.level, techModifiersFor(store.get().technologies.unlocked).costDiscount) ?? 0;
    const afford = coins >= cost;
    card.innerHTML =
      `${head}<div class="upgrade-rows">${rows.map((r) => `<div class="upgrade-row">${r}</div>`).join('')}</div>` +
      `<button class="upgrade-btn${afford ? '' : ' poor'}" data-testid="upgrade-confirm">⬆️ Upgrade ${formatCoins(cost)}</button>`;
    buildList.appendChild(card);
    (card.querySelector('[data-testid="upgrade-confirm"]') as HTMLButtonElement).addEventListener('click', () => {
      const result = upgradeBuilding(store.get(), b.id);
      if (!result.ok) {
        showToast(result.error === 'INSUFFICIENT_FUNDS'
          ? `Not enough funds — need ${formatCoins(result.needed ?? 0)}`
          : UPGRADE_MESSAGES[result.error]);
        return;
      }
      store.set(result.state);
      // Refresh derived capacity/satisfaction immediately (dt=0: no time passes).
      const refreshed = advanceGame(result.state, 0);
      if (refreshed !== result.state) store.set(refreshed);
      showToast(`${BUILDING_ICONS[result.building.type] ?? '🏗️'} ${def.name} upgraded to Level ${result.toLevel}!`);
      lastUpgradeSig = '';
      renderUpgradePanel();
      refreshChip(renderer.selection);
    });
  };

  (bottom.querySelector('[data-testid="nav-build"]') as HTMLButtonElement).addEventListener('click', () => {
    const opening = sheet.hidden || sheetMode !== 'build';
    if (opening) {
      setNeedsOpen(false);
      setEconOpen(false);
      setProgOpen(false);
      setExpandOpen(false);
      sheetMode = 'build';
      lastAffordSig = buildSig();
      renderBuildList(store.get().city?.coins ?? 0);
    }
    setSheetOpen(opening);
  });
  (bottom.querySelector('[data-testid="nav-upgrade"]') as HTMLButtonElement).addEventListener('click', () => {
    const opening = sheet.hidden || sheetMode !== 'upgrade';
    if (opening) {
      setNeedsOpen(false);
      setEconOpen(false);
      setProgOpen(false);
      setExpandOpen(false);
      sheetMode = 'upgrade';
      lastUpgradeSig = '';
      renderUpgradePanel();
    }
    setSheetOpen(opening);
  });
  (bottom.querySelector('[data-testid="nav-expand"]') as HTMLButtonElement).addEventListener('click', () => {
    const opening = expandSheet.hidden;
    if (opening) {
      setSheetOpen(false);
      setNeedsOpen(false);
      setEconOpen(false);
      setProgOpen(false);
      lastExpandSig = '';
      renderExpand();
    }
    setExpandOpen(opening);
  });
  (sheet.querySelector('[data-testid="sheet-close"]') as HTMLButtonElement).addEventListener('click', () => setSheetOpen(false));
  (needsSheet.querySelector('[data-testid="needs-close"]') as HTMLButtonElement).addEventListener('click', () => setNeedsOpen(false));
  (econSheet.querySelector('[data-testid="econ-close"]') as HTMLButtonElement).addEventListener('click', () => setEconOpen(false));
  (progSheet.querySelector('[data-testid="prog-close"]') as HTMLButtonElement).addEventListener('click', () => setProgOpen(false));
  (expandSheet.querySelector('[data-testid="expand-close"]') as HTMLButtonElement).addEventListener('click', () => setExpandOpen(false));
  backdrop.addEventListener('click', () => {
    setSheetOpen(false);
    setNeedsOpen(false);
    setEconOpen(false);
    setProgOpen(false);
    setExpandOpen(false);
  });
  const openNeeds = () => {
    setSheetOpen(false);
    setEconOpen(false);
    setProgOpen(false);
    setExpandOpen(false);
    setNeedsOpen(true);
  };
  const openEcon = () => {
    setSheetOpen(false);
    setNeedsOpen(false);
    setProgOpen(false);
    setExpandOpen(false);
    setEconOpen(true);
  };
  const openProg = () => {
    setSheetOpen(false);
    setNeedsOpen(false);
    setEconOpen(false);
    setExpandOpen(false);
    setProgOpen(true);
  };
  happyBox.addEventListener('click', openNeeds);
  happyBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openNeeds();
    }
  });
  coinsBox.addEventListener('click', openEcon);
  coinsBox.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openEcon();
    }
  });
  stageBar.addEventListener('click', openProg);

  // Single subscription drives HUD, renderer layer, and sheet affordability.
  let lastCoins: number | null = null;
  let lastPop: number | null = null;
  let lastAffordSig = '';
  let lastUpgradeSig = '';
  let lastExpandSig = '';
  let lastMapSig = store.get().map.unlockedExpansionIds.join('|');
  let lastHighest = store.get().progress.highestStageId;
  const discountNow = () => techModifiersFor(store.get().technologies.unlocked).costDiscount;
  const buildSig = (): string => {
    const st = store.get();
    const coins = st.city?.coins ?? 0;
    const highest = st.progress.highestStageId;
    const discount = discountNow();
    return BUILDINGS.map((d) => {
      if (!unlockStatusForStage(d.unlockRequirement, highest).unlocked) return 'L';
      return coins >= constructionCostFor(d, discount) ? '1' : '0';
    }).join('');
  };
  const upgradeSig = (): string => {
    const st = store.get();
    const tile = renderer.selection;
    const b = tile ? st.buildings.find((x) => x.x === tile.col && x.y === tile.row) : undefined;
    if (!b) return 'none';
    const def = getBuildingDef(b.type);
    const cost = def ? upgradeCostFor(def, b.level, discountNow()) : null;
    return `${b.id}@${b.level}:${cost === null ? 'max' : (st.city?.coins ?? 0) >= cost ? 'ok' : 'poor'}`;
  };
  const syncFromStore = () => {
    const s = store.get();
    const coins = s.city?.coins ?? 0;
    coinsSpan.textContent = formatCoins(coins);
    // Pulse on spending (satisfying thunk); income ticks silently + rate label.
    if (lastCoins !== null && coins < lastCoins) {
      coinsBox.classList.remove('pulse');
      void coinsBox.offsetWidth;
      coinsBox.classList.add('pulse');
    }
    // Re-render the open sheet only when its content would actually change.
    if (!sheet.hidden && sheetMode === 'build') {
      const sig = buildSig();
      if (sig !== lastAffordSig) {
        lastAffordSig = sig;
        renderBuildList(coins);
      }
    } else if (!sheet.hidden && sheetMode === 'upgrade') {
      const sig = upgradeSig();
      if (sig !== lastUpgradeSig) {
        lastUpgradeSig = sig;
        renderUpgradePanel();
      }
    }
    lastCoins = coins;

    const sum = economySummary(s);
    const net = sum.netPerMin;
    incomeRate.textContent = net !== 0 ? `${net > 0 ? '+' : '−'}$${Math.abs(Math.round(net))}/min` : '';
    incomeRate.classList.toggle('neg', net < 0);
    incomeRate.title = `Taxes +$${Math.floor(sum.income.taxPerMin)}/min · Business +$${Math.floor(sum.income.businessPerMin)}/min · Upkeep −$${Math.floor(sum.maintenancePerMin)}/min`;

    // Population HUD: "pop / capacity" + housing status + arrival feedback.
    const pop = s.city?.population ?? 0;
    const cap = s.city?.housingCapacity ?? 0;
    popSpan.textContent = `${pop} / ${cap}`;
    popBox.classList.remove('pop-ok', 'pop-warn', 'pop-full', 'pop-need');
    if (cap <= 0) {
      popBox.classList.add('pop-need');
      popBox.title = 'No housing — build homes!';
    } else if (pop >= cap) {
      popBox.classList.add('pop-full');
      popBox.title = 'City is full — build more homes!';
    } else if (pop / cap >= 0.8) {
      popBox.classList.add('pop-warn');
      popBox.title = 'Almost full';
    } else {
      popBox.classList.add('pop-ok');
      popBox.title = 'Room to grow';
    }
    if (lastPop !== null && pop > lastPop) {
      const bump = document.createElement('span');
      bump.className = 'float-up';
      bump.textContent = `+${pop - lastPop}`;
      bump.addEventListener('animationend', () => bump.remove());
      popBox.appendChild(bump);
    } else if (lastPop !== null && pop < lastPop) {
      const drop = document.createElement('span');
      drop.className = 'float-down';
      drop.textContent = `−${lastPop - pop}`;
      drop.addEventListener('animationend', () => drop.remove());
      popBox.appendChild(drop);
    }
    lastPop = pop;

    // Satisfaction HUD: authoritative snapshot + band color.
    const sat = s.city?.satisfaction ?? 0;
    happySpan.textContent = `${Math.round(sat * 100)}%`;
    happyBox.classList.remove('sat-good', 'sat-warning', 'sat-poor', 'sat-critical');
    happyBox.classList.add(`sat-${satisfactionBand(sat)}`);
    happyBox.title = 'City satisfaction — tap for details';

    const sync = top.querySelector('[data-testid="sync-status"]');
    if (sync) sync.textContent = s.cloudEnabled ? '● cloud' : '○ offline';

    // Living map: rebuild only when the unlocked set changes (purchases).
    const mapSig = s.map.unlockedExpansionIds.join('|');
    if (mapSig !== lastMapSig) {
      lastMapSig = mapSig;
      mapDef = buildMapDef(s.map.unlockedExpansionIds);
      renderer.setMapDef(mapDef, zoneBadges());
      lastAffordSig = '';
      lastExpandSig = '';
      refreshChip(renderer.selection);
    }
    renderer.setBuildings(s.buildings);
    if (!expandSheet.hidden) {
      const sig = `${mapSig}:${coins}`;
      if (sig !== lastExpandSig) {
        lastExpandSig = sig;
        renderExpand();
      }
    }

    // Stage bar + era celebration (highest only moves forward — no flicker).
    const highest = s.progress.highestStageId;
    const cur = getStageForPopulation(pop);
    const nxt = nextStage(cur.id);
    stageBar.innerHTML = nxt
      ? `<span>${cur.icon} ${cur.name}</span><span class="stagebar-prog">👥 ${pop}/${nxt.popRequired} → ${nxt.icon} ${nxt.name}</span>`
      : `<span>${cur.icon} ${cur.name}</span><span class="stagebar-prog">Peak of civilization!</span>`;
    if (lastHighest !== null && highest !== lastHighest) {
      const def = getStageDef(highest);
      const freshUnlocks = BUILDINGS.filter(
        (d) => d.unlockRequirement && unlockStatusForStage(d.unlockRequirement, highest).unlocked
      ).length;
      showToast(`🎉 New era: ${def?.name ?? highest}! ${freshUnlocks > 0 ? 'New buildings unlocked.' : ''}`);
      lastAffordSig = '';
      if (!progSheet.hidden) renderProgress();
    }
    lastHighest = highest;
  };
  store.subscribe(syncFromStore);
  syncFromStore();
}
