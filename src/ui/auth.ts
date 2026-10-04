import { authService, onAuthStateChange, getSupabase, getCurrentUser } from '../services/authService';
import { buildGameUI } from './gameUI';

/**
 * Initialize the authentication flow
 */
export function initAuth(): void {
  // Create auth overlay
  if (!document.getElementById('auth-overlay')) {
    const authOverlay = document.createElement('div');
    authOverlay.id = 'auth-overlay';
    authOverlay.innerHTML = `
      <div class="auth-card">
        <h2>Pocketopolis</h2>
        <p class="auth-subtitle">Build your civilization</p>
        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Sign In</button>
          <button class="auth-tab" data-tab="signup">Create Account</button>
        </div>
        <form id="auth-form">
          <input type="email" id="auth-email" placeholder="Email" required autocomplete="email" />
          <input type="password" id="auth-password" placeholder="Password" required autocomplete="new-password" />
          <button type="submit" class="auth-submit">Sign In</button>
          <p id="auth-error" class="auth-error" hidden></p>
        </form>
      </div>
    `;
    document.body.appendChild(authOverlay);
  }

  const authForm = document.getElementById('auth-form') as HTMLFormElement;
  const authError = document.getElementById('auth-error')!;
  const emailInput = document.getElementById('auth-email') as HTMLInputElement;
  const passwordInput = document.getElementById('auth-password') as HTMLInputElement;
  let authMode: 'login' | 'signup' = 'login';

  const setAuthMode = (mode: 'login' | 'signup') => {
    document.querySelectorAll('.auth-tab').forEach(t => (t as HTMLElement).classList.toggle('active', (t as HTMLElement).dataset.tab === mode));
    const submitBtn = document.querySelector('.auth-submit') as HTMLButtonElement;
    submitBtn.textContent = mode === 'login' ? 'Sign In' : 'Create Account';
    document.getElementById('auth-error')!.hidden = true;
  }

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => setAuthMode((tab as HTMLElement).dataset.tab as 'login' | 'signup'));
  });


  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('auth-error')!.hidden = true;
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) return;

    if (authMode === 'login') {
      const { error } = await authService.signIn(email, password);
      if (error) {
        authError.textContent = error;
        authError.hidden = false;
        return;
      }
    } else {
      const { error } = await authService.signUp(email, password);
      if (error) {
        authError.textContent = error;
        authError.hidden = false;
        return;
      }
    }
  });

  // Set up auth state listener
  onAuthStateChange((user) => {
    const authOverlay = document.getElementById('auth-overlay')!;
    const gameUI = document.getElementById('game-ui')!;
    if (user) {
      document.getElementById('auth-overlay')!.hidden = true;
      document.getElementById('game-ui')!.hidden = false;
      initGameUI();
    } else {
      document.getElementById('game-ui')!.hidden = true;
      document.getElementById('auth-overlay')!.hidden = false;
    }
  });

  // Check if already logged in — handle initial state properly
  const supabase = getSupabase();
  if (supabase && getCurrentUser()) {
    // User is already logged in with Supabase — load city from Supabase
    document.getElementById('auth-overlay')!.hidden = true;
    document.getElementById('game-ui')!.hidden = false;
    initGameUI();
  } else if (supabase) {
    // Supabase configured but no user yet — show auth overlay
    document.getElementById('auth-overlay')!.hidden = false;
    document.getElementById('game-ui')!.hidden = true;
  } else {
    // Local-only mode — skip auth, load from localStorage
    document.getElementById('auth-overlay')!.hidden = true;
    document.getElementById('game-ui')!.hidden = false;
    initGameUI();
  }
}

async function initGameUI(): Promise<void> {
  const { createStore } = await import('../game/state/store');
  const { createFreshGameState } = await import('../game/city/newCity');
  const { loadLocal, saveLocal } = await import('../lib/localSave');
  const { buildGameUI } = await import('./gameUI');
  const { cityService, loadCity } = await import('../services/cityService');
  const { isCloudEnabled, getCurrentUser } = await import('../services/supabaseClient');

  const cloudEnabled = isCloudEnabled();
  const supabase = getSupabase();
  let saved: import('../game/state/types').GameState | null;

  if (cloudEnabled && supabase && getCurrentUser()) {
    // Load city from Supabase
    const loaded = await loadCity();
    if (loaded) {
      saved = loaded;
    } else {
      // No city yet — start fresh
      saved = createFreshGameState(cloudEnabled);
    }
  } else {
    saved = loadLocal();
  }

  const store = createStore(saved ?? createFreshGameState(cloudEnabled));
  store.update({ cloudEnabled: true });

  const gameUI = document.getElementById('game-ui')!;
  const renderer = buildGameUI(gameUI, store);

  // Immediately set buildings from store so the map renders the city
  const initialBuildings = store.get().buildings;
  renderer.setBuildings(initialBuildings);

  // Subscribe to store changes to keep renderer in sync
  store.subscribe((state) => {
    renderer.setBuildings(state.buildings);
  });

  // Start the sim tick driver (1s interval, updates population/economy)
  // Runs in both cloud and local mode — sim reads from store state
  const { startTickDriver } = await import('../game/sim/tick');
  startTickDriver(store, 1000);

  // Cleanup unsubscribe on component unmount (simple approach for now)
  // Note: in a React app would use useEffect cleanup, but here we keep it simple

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
}
