import { getSupabase, getCurrentUser } from './supabaseClient';
import { logger } from '../lib/logger';
import type { CityState, BuildingInstance } from '../game/state/types';

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

export const cityService = {
  async loadCity(): Promise<CityState | null> {
    const cityId = await getCityId();
    if (!cityId) return null;
    const supabase = getSupabase();
    if (!supabase) return null;

    const [
      { data: city, error: cityErr },
      { data: buildings, error: buildingsErr },
      { data: techs, error: techsErr },
      { data: map, error: mapErr }
    ] = await Promise.all([
      supabase.from('cities').select('*').eq('id', cityId).single(),
      supabase.from('buildings').select('*').eq('city_id', cityId),
      supabase.from('city_technologies').select('tech_id').eq('city_id', cityId),
      supabase.from('city_map').select('unlocked_expansion_ids').eq('city_id', cityId).single()
    ]);

    if (cityErr || !city) {
      logger.error('Failed to load city', cityErr);
      return null;
    }

    return {
      id: city.id,
      name: city.city_name,
      era: city.era,
      coins: city.coins,
      population: city.population,
      housingCapacity: city.housing_capacity,
      populationProgress: city.population_progress,
      ageSec: city.age_sec,
      satisfaction: city.satisfaction,
      highestStageId: city.highest_stage_id
    } as CityState;
  },

  async saveCity(cityState: CityState, buildings: BuildingInstance[], techIds: string[], expansionIds: string[]): Promise<boolean> {
    const cityId = await getCityId();
    if (!cityId) return false;
    const supabase = getSupabase();
    if (!supabase) return false;

    const { error: cityErr } = await supabase
      .from('cities')
      .update({
        city_name: cityState.name,
        era: cityState.era,
        coins: cityState.coins,
        population: cityState.population,
        housing_capacity: cityState.housingCapacity,
        population_progress: cityState.populationProgress,
        age_sec: cityState.ageSec,
        satisfaction: cityState.satisfaction,
        highest_stage_id: cityState.highestStageId,
        updated_at: new Date().toISOString()
      })
      .eq('id', cityId);

    if (cityErr) {
      logger.error('Failed to save city', cityErr);
      return false;
    }

    // Buildings: upsert (delete + insert for simplicity)
    await supabase.from('buildings').delete().eq('city_id', cityId);
    if (buildings.length > 0) {
      const { error } = await supabase.from('buildings').insert(
        buildings.map(b => ({
          city_id: cityId,
          type: b.type,
          x: b.x,
          y: b.y,
          level: b.level
        }))
      );
      if (error) logger.error('Failed to save buildings', error);
    }

    // Technologies
    await supabase.from('city_technologies').delete().eq('city_id', cityId);
    if (techIds.length > 0) {
      await supabase.from('city_technologies').insert(
        techIds.map(tid => ({ city_id: cityId, tech_id: tid }))
      );
    }

    // Map
    await supabase.from('city_map').upsert({
      city_id: cityId,
      unlocked_expansion_ids: expansionIds
    });

    return true;
  }
};
