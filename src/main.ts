import './styles/global.css';
import { createStore } from './game/state/store';
import { createFreshGameState } from './game/city/newCity';
import { startTickDriver } from './game/sim/tick';
import { buildShell } from './ui/shell';
import { isCloudEnabled } from './services/supabaseClient';
import { loadLocal, saveLocal } from './lib/localSave';
import { logger } from './lib/logger';

/**
 * Phase 4 boot: store (restored from temporary local save or fresh),
 * shell, online tick driver, backend presence flag. Local save is dev
 * convenience only — cloud save replaces it in a later phase.
 */
function boot(): void {
  const app = document.getElementById('app');
  if (!app) {
    logger.error('#app root missing');
    return;
  }

  const cloudEnabled = isCloudEnabled();
  const saved = loadLocal();
  const store = createStore(saved ?? createFreshGameState(cloudEnabled));
  store.update({ cloudEnabled });
  store.subscribe((s) => saveLocal(s));

  buildShell(app, store);
  const driver = startTickDriver(store);
  window.addEventListener('beforeunload', () => driver.stop());
  logger.info(`ready. cloud=${cloudEnabled ? 'enabled' : 'local-only'}`);
}

boot();
