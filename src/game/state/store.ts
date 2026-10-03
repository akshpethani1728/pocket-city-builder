import { createInitialState, type GameState } from './types';

type Listener = (state: GameState) => void;

/**
 * Tiny observable store — no framework, no re-render storms.
 * UI subscribes selectively; render loop reads via get() without subscribing.
 * Gameplay mutations arrive in later phases; for now only set/replace + reset.
 */
export function createStore(initial: GameState = createInitialState()) {
  let state = initial;
  const listeners = new Set<Listener>();

  return {
    get(): GameState {
      return state;
    },
    set(next: GameState): void {
      state = next;
      listeners.forEach((l) => l(state));
    },
    update(patch: Partial<GameState>): void {
      state = { ...state, ...patch };
      listeners.forEach((l) => l(state));
    },
    reset(): void {
      state = createInitialState();
      listeners.forEach((l) => l(state));
    },
    subscribe(fn: Listener): () => void {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    }
  };
}

export type GameStore = ReturnType<typeof createStore>;
