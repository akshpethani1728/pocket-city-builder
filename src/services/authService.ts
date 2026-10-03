import { signInWithEmail, signUpWithEmail, signOut, onAuthStateChange, getCurrentUser, getSupabase } from './supabaseClient';

export const authService = {
  async signIn(email: string, password: string) {
    return signInWithEmail(email, password);
  },

  async signUp(email: string, password: string) {
    return signUpWithEmail(email, password);
  },

  async signOut() {
    return signOut();
  },

  async getCurrentUser() {
    return getCurrentUser();
  },

  onAuthStateChange(callback: (user: { id: string; email: string } | null) => void) {
    return onAuthStateChange((_event, session) => {
      callback(session?.user ? { id: session.user.id, email: session.user.email ?? '' } : null);
    });
  }
};

export { onAuthStateChange, getSupabase };
