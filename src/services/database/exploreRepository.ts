import { supabase } from '@/services/supabaseClient';
import type { TripExploreItemRow } from './rows';
import {
  tripExploreItemFromRow,
  tripExploreItemToRow,
  type TripExploreItem,
} from './exploreMappers';

export {
  explorePlaceFromItem,
  explorePlaceToItem,
  noteToExploreItem,
  tripExploreItemFromRow,
  tripExploreItemToRow,
  type TripExploreItem,
} from './exploreMappers';

export async function listTripExploreItems(tripId: string): Promise<TripExploreItem[]> {
  const { data, error } = await supabase
    .from('trip_explore_items')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TripExploreItemRow[]).map(tripExploreItemFromRow);
}

export async function upsertTripExploreItem(item: TripExploreItem): Promise<TripExploreItem> {
  const { data, error } = await supabase
    .from('trip_explore_items')
    .upsert(tripExploreItemToRow(item))
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return tripExploreItemFromRow(data as TripExploreItemRow);
}

export async function deleteTripExploreItem(itemId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_explore_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId);

  if (error) {
    throw error;
  }
}
