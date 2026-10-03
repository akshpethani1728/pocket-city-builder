import { getSupabase, getCurrentUser } from './supabaseClient';
import { logger } from '../lib/logger';

async function getCityId(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('cities')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (error || !data) return null;
  return data.id;
}

export const economyService = {
  async transferFunds(toUserId: string, amount: number, idempotencyKey: string): Promise<{ ok: boolean; error?: string; newBalance?: number }> {
    const supabase = getSupabase();
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: 'Not authenticated' };

    const { data, error } = await supabase.rpc('transfer_funds', {
      p_to_user_id: toUserId,
      p_amount: amount,
      p_idempotency_key: idempotencyKey
    });
    if (error) {
      logger.error('Transfer failed', error);
      return { ok: false, error: error.message };
    }
    return { ok: true, newBalance: data?.new_balance };
  }
};
