import { supabase } from '@/services/supabaseClient';

export type UserProfile = {
  id: string;
  displayName: string;
  homeCurrency: string;
  createdAt: string;
  updatedAt: string;
};

type UserProfileRow = {
  id: string;
  display_name: string;
  home_currency: string;
  created_at: string;
  updated_at: string;
};

export async function ensureUserProfile(userId: string, displayName = 'Roadtrip Planner'): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        display_name: displayName,
        home_currency: 'SEK',
      },
      { onConflict: 'id' },
    )
    .select('id, display_name, home_currency, created_at, updated_at')
    .single();

  if (error) {
    throw error;
  }

  return profileFromRow(data as UserProfileRow);
}

function profileFromRow(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    homeCurrency: row.home_currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
