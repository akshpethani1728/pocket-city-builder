import { notImplemented } from '../lib/logger';

/** Google login via Supabase Auth — dedicated later phase. */
export const authService = {
  async signInWithGoogle(): Promise<never> {
    return notImplemented('authService.signInWithGoogle');
  },
  async signOut(): Promise<never> {
    return notImplemented('authService.signOut');
  },
  async getSession(): Promise<never> {
    return notImplemented('authService.getSession');
  }
};
