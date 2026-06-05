import type { Expense, ItineraryNode, Trip } from '@/models';
import { supabase } from '@/services/supabaseClient';
import { expenseFromRow, expenseToRow, itineraryNodeFromRow, itineraryNodeToRow, tripFromRow, tripToRow } from './mappers';
import type { ExpenseRow, ItineraryNodeRow, TripRow } from './rows';

type TripMemberRow = {
  trip_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
};

export async function listTrips(): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .is('deleted_at', null)
    .order('starts_at', { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as TripRow[]).map(tripFromRow);
}

export async function upsertTrip(trip: Trip): Promise<Trip> {
  const { data, error } = await supabase.from('trips').upsert(tripToRow(trip)).select('*').single();

  if (error) {
    throw error;
  }

  return tripFromRow(data as TripRow);
}

export async function createTripForOwner(ownerId: string, name = 'Alpine Roadtrip'): Promise<Trip> {
  const now = new Date().toISOString();
  const trip: Trip = {
    id: cryptoRandomId(),
    ownerId,
    name,
    description: 'Private roadtrip workspace synced with Supabase.',
    baseCurrency: 'SEK',
    startsAt: now,
    endsAt: null,
    homeLocation: null,
    settings: {
      avoidTolls: false,
      avoidHighways: false,
      preferScenicRoutes: true,
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  };

  const createdTrip = await upsertTrip(trip);
  await ensureTripOwnerMembership(createdTrip.id, ownerId);

  return createdTrip;
}

export async function ensureFirstTrip(ownerId: string): Promise<Trip> {
  const existingTrips = await listTrips();
  const firstTrip = existingTrips[0];

  if (firstTrip) {
    return firstTrip;
  }

  return createTripForOwner(ownerId);
}

export async function createTripShareCode(tripId: string): Promise<string> {
  const { data, error } = await supabase.rpc('create_trip_invite', {
    input_trip_id: tripId,
  });

  if (error) {
    throw error;
  }

  return String(data);
}

export async function joinTripByShareCode(code: string): Promise<Trip> {
  const { data, error } = await supabase.rpc('join_trip_by_code', {
    input_code: code.trim(),
  });

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('No trip returned after joining.');
  }

  return tripFromRow(data as TripRow);
}

async function ensureTripOwnerMembership(tripId: string, userId: string): Promise<TripMemberRow> {
  const { data, error } = await supabase
    .from('trip_members')
    .upsert(
      {
        trip_id: tripId,
        user_id: userId,
        role: 'owner',
      },
      { onConflict: 'trip_id,user_id' },
    )
    .select('trip_id, user_id, role')
    .single();

  if (error) {
    throw error;
  }

  return data as TripMemberRow;
}

export async function listItineraryNodes(tripId: string): Promise<ItineraryNode[]> {
  const { data, error } = await supabase
    .from('itinerary_nodes')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ItineraryNodeRow[]).map(itineraryNodeFromRow);
}

export async function upsertItineraryNode(node: ItineraryNode): Promise<ItineraryNode> {
  const { data, error } = await supabase.from('itinerary_nodes').upsert(itineraryNodeToRow(node)).select('*').single();

  if (error) {
    throw error;
  }

  return itineraryNodeFromRow(data as ItineraryNodeRow);
}

export async function deleteItineraryNode(nodeId: string): Promise<void> {
  const { error } = await supabase
    .from('itinerary_nodes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', nodeId);

  if (error) {
    throw error;
  }
}

export async function listExpenses(tripId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('trip_id', tripId)
    .is('deleted_at', null)
    .order('occurred_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as ExpenseRow[]).map(expenseFromRow);
}

export async function upsertExpense(expense: Expense): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').upsert(expenseToRow(expense)).select('*').single();

  if (error) {
    throw error;
  }

  return expenseFromRow(data as ExpenseRow);
}

function cryptoRandomId(): string {
  if ('crypto' in globalThis && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
