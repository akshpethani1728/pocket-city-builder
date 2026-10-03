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

export const achievementService = {
  async recordProgress(achievementId: string, progress: number): Promise<boolean> {
    const cityId = await getCityId();
    if (!cityId) return false;
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase
      .from('city_achievements')
      .upsert({ city_id: cityId, achievement_id: achievementId, progress });
    if (error) {
      logger.error('Failed to record achievement progress', error);
      return false;
    }
    return true;
  }
};
