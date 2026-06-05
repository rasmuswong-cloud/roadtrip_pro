import type { Poi } from '@/models';
import { supabase } from '@/services/supabaseClient';
import { parsePostgisPoint, toPostgisPoint } from './geo';

type PoiRow = {
  id: string;
  trip_id: string | null;
  created_by: string;
  name: string;
  category: string;
  location: unknown;
  address: string | null;
  source: Poi['source'];
  external_ref: string | null;
  rating: number | null;
  opening_hours: Record<string, unknown>;
  contact: Record<string, string>;
  imagery: Array<{ url: string; attribution?: string }>;
  metadata: Record<string, unknown>;
  is_private: boolean;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export async function upsertPoi(poi: Poi): Promise<Poi> {
  const { data, error } = await supabase
    .from('pois')
    .upsert(poiToRow(poi), { onConflict: 'source,external_ref' })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return poiFromRow(data as PoiRow);
}

export async function listPois(tripId: string): Promise<Poi[]> {
  const { data, error } = await supabase
    .from('pois')
    .select('*')
    .or(`trip_id.eq.${tripId},trip_id.is.null`)
    .is('deleted_at', null)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as PoiRow[]).map(poiFromRow);
}

function poiFromRow(row: PoiRow): Poi {
  const location = parsePostgisPoint(row.location);
  if (!location) {
    throw new Error(`POI ${row.id} is missing a valid location.`);
  }

  return {
    id: row.id,
    tripId: row.trip_id,
    createdBy: row.created_by,
    name: row.name,
    category: row.category,
    location,
    address: row.address,
    source: row.source,
    externalRef: row.external_ref,
    rating: row.rating,
    openingHours: row.opening_hours,
    contact: row.contact,
    imagery: row.imagery,
    metadata: row.metadata,
    isPrivate: row.is_private,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function poiToRow(poi: Poi): Partial<PoiRow> {
  return {
    id: poi.id,
    trip_id: poi.tripId ?? null,
    created_by: poi.createdBy,
    name: poi.name,
    category: poi.category,
    location: toPostgisPoint(poi.location),
    address: poi.address ?? null,
    source: poi.source,
    external_ref: poi.externalRef ?? null,
    rating: poi.rating ?? null,
    opening_hours: poi.openingHours,
    contact: poi.contact,
    imagery: poi.imagery,
    metadata: poi.metadata,
    is_private: poi.isPrivate,
  };
}
