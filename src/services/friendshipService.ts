import { getSupabase, getCurrentUser } from './supabaseClient';
import { logger } from '../lib/logger';

export const friendshipService = {
  async sendRequest(addresseeId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const user = await getCurrentUser();
    if (!user) return false;
    const { error } = await supabase
      .from('friendships')
      .insert({ requester_id: user.id, addressee_id: addresseeId });
    if (error) {
      logger.error('Failed to send friend request', error);
      return false;
    }
    return true;
  },

  async acceptRequest(requesterId: string): Promise<boolean> {
    const supabase = getSupabase();
    if (!supabase) return false;
    const user = await getCurrentUser();
    if (!user) return false;
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', requesterId)
      .eq('addressee_id', user.id);
    if (error) {
      logger.error('Failed to accept friend request', error);
      return false;
    }
    return true;
  }
};
