import type { User } from '@supabase/supabase-js';
import { supabase } from '@/services/supabaseClient';

export async function getCurrentUser(): Promise<User | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error.message.toLowerCase().includes('auth session missing')) {
      return null;
    }

    throw error;
  }

  return user;
}

export async function sendMagicLink(email: string): Promise<void> {
  const redirectTo =
    typeof window === 'undefined' || !window.location?.origin ? undefined : `${window.location.origin}/`;
  const credentials = redirectTo ? { email, options: { emailRedirectTo: redirectTo } } : { email };
  const { error } = await supabase.auth.signInWithOtp(credentials);

  if (error) {
    throw error;
  }
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getOrCreateAnonymousUser(): Promise<User> {
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  if (getUserError) {
    if (getUserError.message.toLowerCase().includes('auth session missing')) {
      const { data, error } = await supabase.auth.signInAnonymously();

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error('Supabase did not return a user after anonymous sign-in.');
      }

      return data.user;
    }

    throw getUserError;
  }

  if (user) {
    return user;
  }

  const { data, error } = await supabase.auth.signInAnonymously();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('Supabase did not return a user after anonymous sign-in.');
  }

  return data.user;
}
