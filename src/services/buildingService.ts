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

export const buildingService = {
  async placeBuilding(cityId: string, type: string, x: number, y: number): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !cityId) return false;
    const { error } = await supabase
      .from('buildings')
      .insert({ city_id: cityId, type, x, y, level: 1 });
    if (error) {
      logger.error('Failed to place building', error);
      return false;
    }
    return true;
  },

  async upgradeBuilding(cityId: string, buildingId: string, newLevel: number): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase || !cityId) return false;
    const { error } = await supabase
      .from('buildings')
      .update({ level: newLevel })
      .eq('id', buildingId)
      .eq('city_id', cityId);
    if (error) {
      logger.error('Failed to upgrade building', error);
      return false;
    }
    return true;
  }
};
