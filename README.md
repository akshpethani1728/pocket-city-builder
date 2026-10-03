# Pocketopolis — Phase 1 Foundation

Mobile-first 2D/2.5D idle city-builder PWA. Phase 1 = runnable architecture only.
No gameplay yet: no population, buildings, economy, map sim, tech, friends, or transfers.

## Scripts

- `npm run dev` — local dev server (http://localhost:5173)
- `npm run build` — typecheck + production build
- `npm run preview` — preview the build
- `npm run typecheck` — strict TS check

Requires Node >= 18.

## Env

1. Copy `.env.example` to `.env`
2. Fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (public anon key only)
3. Without env, the app runs in local-only mode with a warning (by design)

> NEVER put a Supabase service-role key in the client. Economy mutations will
> go through server-side RPC in later phases.

## Structure

- `src/game/state/` — central `GameState` types + tiny observable `createStore`
- `src/game/config/` — data-driven def types (`BuildingDef`, rules) + `ConfigRegistry`
- `src/game/sim/` — pure time helpers only (`clock.ts`); sim arrives later
- `src/render/` — `Renderer` interface + `PlaceholderRenderer` (Pixi plugs in Phase 2)
- `src/ui/` — mobile-first shell (top HUD / map area / bottom nav placeholders)
- `src/services/` — `supabaseClient` + stubs (auth/player/city/building/economy/tech/achievement/friendship/transaction)
- `src/lib/` — `env`, `logger`
- `public/manifest.webmanifest` + `public/icons/` — PWA installability foundation

## Tech decisions (Phase 1)

- Vite + TypeScript + `@supabase/supabase-js` only. No UI framework, no Pixi yet,
  no PWA plugin — keeps install small and leaves room for Phase 2 choices.
- PWA = manifest + viewport + theme-color + icons for now; service worker /
  offline progression comes with the idle phase.
- Sim/render/UI are decoupled: `sim` is pure, `render` depends on an interface,
  the store is framework-free with selective subscriptions.

## What is intentionally missing

Gameplay, DB schema, Google login, placement, offline accrual, balancing.
Each has a stub + owner phase and throws `notImplemented` if called.
