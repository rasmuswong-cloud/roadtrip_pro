import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const fallbackSupabaseUrl = 'http://127.0.0.1:54321';
const fallbackSupabaseAnonKey = 'missing-supabase-anon-key';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export function getSupabaseConfigurationError(): string | null {
  return isSupabaseConfigured ? null : 'Supabase är inte konfigurerat i den här miljön.';
}

export function assertSupabaseConfigured(): void {
  const configurationError = getSupabaseConfigurationError();

  if (configurationError) {
    throw new Error(configurationError);
  }
}

export const supabase = createClient(supabaseUrl ?? fallbackSupabaseUrl, supabaseAnonKey ?? fallbackSupabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});
