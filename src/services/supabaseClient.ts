import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getEnv, hasSupabaseEnv } from '../lib/env';
import { logger } from '../lib/logger';

let cached: SupabaseClient | null = null;
let attempted = false;

/**
 * Supabase client singleton — Phase 1 foundation only.
 * - Uses ONLY VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (public).
 * - NEVER add a service-role key here; it would ship to every browser.
 * - Returns null when env is missing so the app runs offline-safe.
 * Auth + schema + RLS arrive in a dedicated later phase.
 */
export function getSupabase(): SupabaseClient | null {
  if (cached) return cached;
  if (attempted) return null;
  attempted = true;

  if (!hasSupabaseEnv()) {
    logger.warn('Supabase env missing — running in local-only mode.');
    return null;
  }

  cached = createClient(getEnv('VITE_SUPABASE_URL')!, getEnv('VITE_SUPABASE_ANON_KEY')!, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  return cached;
}

export function isCloudEnabled(): boolean {
  return getSupabase() !== null;
}
