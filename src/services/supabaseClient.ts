import { createClient, type SupabaseClient, type Session, type User } from '@supabase/supabase-js';
import { getEnv, hasSupabaseEnv } from '../lib/env';
import { logger } from '../lib/logger';

let cached: SupabaseClient | null = null;
let attempted = false;

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

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getCurrentSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session ?? null;
}

export async function signInWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { user: null, error: 'Supabase not configured' };
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data.user ?? null, error: error?.message ?? null };
}

export async function signUpWithEmail(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
  const supabase = getSupabase();
  if (!supabase) return { user: null, error: 'Supabase not configured' };
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { user: data.user ?? null, error: error?.message ?? null };
}

export async function signOut(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return 'Supabase not configured';
  const { error } = await supabase.auth.signOut();
  return error?.message ?? null;
}

export function onAuthStateChange(callback: (event: string, session: Session | null) => void): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => subscription.unsubscribe();
}
