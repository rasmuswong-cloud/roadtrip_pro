import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/services/supabaseClient';
import type { SyncTable } from './types';

export type RealtimeChangeHandler = (event: {
  table: SyncTable;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  newRecord: Record<string, unknown> | null;
  oldRecord: Record<string, unknown> | null;
}) => void;

const TABLES: SyncTable[] = ['trips', 'pois', 'itinerary_nodes', 'expenses', 'budgets'];

export function subscribeToTripChanges(tripId: string, onChange: RealtimeChangeHandler): RealtimeChannel {
  const channel = supabase.channel(`trip:${tripId}`);

  for (const table of TABLES) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: table === 'trips' ? `id=eq.${tripId}` : `trip_id=eq.${tripId}`,
      },
      (payload) => {
        onChange({
          table,
          type: payload.eventType,
          newRecord: payload.new as Record<string, unknown> | null,
          oldRecord: payload.old as Record<string, unknown> | null,
        });
      },
    );
  }

  channel.subscribe();
  return channel;
}
