import { authService, onAuthStateChange } from './services/authService';
import { cityService } from './services/cityService';
import { getSupabase, isCloudEnabled } from './services/supabaseClient';
import { createStore } from './game/state/store';
import { createFreshGameState } from './game/city/newCity';
import { loadLocal, saveLocal } from './lib/localSave';
import { initAuth } from './ui/auth';
import { buildGameUI } from './ui/gameUI';
import { logger } from './lib/logger';

/**
 * Pocketopolis - Main entry point
 * Handles auth flow and game initialization
 */
async function boot(): Promise<void> {
  const cloudEnabled = isCloudEnabled();
  const supabase = getSupabase();

  let saved = cloudEnabled && supabase ? null : loadLocal();
  const store = createStore(saved ?? createFreshGameState(cloudEnabled));
  store.update({ cloudEnabled });

  // Subscribe to store changes for persistence
  if (cloudEnabled) {
    store.subscribe((s) => cityService.saveCity(
      s.city as any,
      s.buildings,
      s.technologies.unlocked,
      s.map.unlockedExpansionIds
    ));
  } else {
    store.subscribe((s) => saveLocal(s));
  }

  // Initialize auth flow
  initAuth();
}

boot().catch(logger.error);