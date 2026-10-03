/** Typed access to Vite env. Only public (VITE_) vars — no secrets here. */
export function getEnv(name: string): string | undefined {
  const value = (import.meta.env as Record<string, unknown>)[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function hasSupabaseEnv(): boolean {
  return Boolean(getEnv('VITE_SUPABASE_URL') && getEnv('VITE_SUPABASE_ANON_KEY'));
}
