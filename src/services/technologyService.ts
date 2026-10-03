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

export const technologyService = {
  async unlock(techId: string): Promise<boolean> {
    const cityId = await getCityId();
    if (!cityId) return false;
    const supabase = getSupabase();
    if (!supabase) return false;
    const { error } = await supabase
      .from('city_technologies')
      .insert({ city_id: cityId, tech_id: techId });
    if (error) {
      logger.error('Failed to unlock technology', error);
      return false;
    }
    return true;
  }
};
