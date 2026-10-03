import { defineConfig } from 'vite';

// Phase 1: minimal Vite config. No game deps, no PWA plugin yet.
// PWA is manifest + meta only for now (see public/manifest.webmanifest).
// Workbox / service-worker caching arrives in a later phase (offline progression).
export default defineConfig({
  server: {
    port: 5173,
    host: true
  },
  preview: {
    port: 4173
  },
  build: {
    target: 'es2020',
    sourcemap: false
  }
});
