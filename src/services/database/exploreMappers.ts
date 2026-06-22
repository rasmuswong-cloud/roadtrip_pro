import type { ExploreCategory, ExplorePlace, ImageSource } from '@/services/planning/exploreBoard';
import type { TripExploreItemRow } from './rows';

export type TripExploreItem = {
  id: string;
  tripId: string;
  createdBy: string;
  itemType: 'note' | 'place' | 'section';
  title: string;
  description: string | null;
  category: string | null;
  placeName: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  googlePlaceId: string | null;
  googleMapsUrl: string | null;
  googleRating: number | null;
  googlePrimaryType: string | null;
  photoName: string | null;
  photoReference: string | null;
  photoUrl: string | null;
  photoAttributions: unknown[];
  imageSource: ImageSource;
  sortOrder: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export function tripExploreItemFromRow(row: TripExploreItemRow): TripExploreItem {
  return {
    id: row.id,
    tripId: row.trip_id,
    createdBy: row.created_by,
    itemType: row.item_type,
    title: row.title,
    description: row.description,
    category: row.category,
    placeName: row.place_name,
    formattedAddress: row.formatted_address,
    latitude: row.latitude,
    longitude: row.longitude,
    googlePlaceId: row.google_place_id,
    googleMapsUrl: row.google_maps_url,
    googleRating: row.google_rating,
    googlePrimaryType: row.google_primary_type,
    photoName: row.photo_name,
    photoReference: row.photo_reference,
    photoUrl: row.photo_url,
    photoAttributions: Array.isArray(row.photo_attributions) ? row.photo_attributions : [],
    imageSource: row.image_source,
    sortOrder: row.sort_order,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

export function tripExploreItemToRow(item: TripExploreItem): Partial<TripExploreItemRow> {
  return {
    id: item.id,
    trip_id: item.tripId,
    created_by: item.createdBy,
    item_type: item.itemType,
    title: item.title,
    description: item.description,
    category: item.category,
    place_name: item.placeName,
    formatted_address: item.formattedAddress,
    latitude: item.latitude,
    longitude: item.longitude,
    google_place_id: item.googlePlaceId,
    google_maps_url: item.googleMapsUrl,
    google_rating: item.googleRating,
    google_primary_type: item.googlePrimaryType,
    photo_name: item.photoName,
    photo_reference: item.photoReference,
    photo_url: item.photoUrl,
    photo_attributions: item.photoAttributions,
    image_source: item.imageSource,
    sort_order: item.sortOrder,
    metadata: item.metadata,
    deleted_at: item.deletedAt,
  };
}

export function explorePlaceFromItem(item: TripExploreItem): ExplorePlace | null {
  if (item.itemType !== 'place') {
    return null;
  }

  return {
    id: item.id,
    title: item.title || 'Plats',
    place: item.formattedAddress ?? item.placeName ?? '',
    category: normalizeExploreCategory(item.category),
    type: normalizeNodeType(item.metadata.type),
    coordinates: Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
      ? { latitude: item.latitude!, longitude: item.longitude! }
      : null,
    rating: item.googleRating,
    imageUrl: item.photoUrl,
    imageSource: item.imageSource,
    photoAttributions: item.photoAttributions,
    statusChips: Number.isFinite(item.latitude) && Number.isFinite(item.longitude) ? ['Kartposition klar'] : ['Saknar kartposition'],
    ...(item.description ? { description: item.description } : {}),
    ...(item.googlePlaceId ? { googlePlaceId: item.googlePlaceId } : {}),
    ...(item.googleMapsUrl ? { mapsUrl: item.googleMapsUrl } : {}),
    ...(item.photoName ? { photoName: item.photoName } : {}),
  };
}

export function explorePlaceToItem(input: {
  place: ExplorePlace;
  tripId: string;
  userId: string;
  sortOrder: number;
}): TripExploreItem {
  const now = new Date().toISOString();
  return {
    id: normalizeUuid(input.place.id),
    tripId: input.tripId,
    createdBy: input.userId,
    itemType: 'place',
    title: input.place.title,
    description: input.place.description ?? null,
    category: input.place.category,
    placeName: input.place.place ?? null,
    formattedAddress: input.place.place ?? null,
    latitude: Number.isFinite(input.place.coordinates?.latitude) ? input.place.coordinates!.latitude : null,
    longitude: Number.isFinite(input.place.coordinates?.longitude) ? input.place.coordinates!.longitude : null,
    googlePlaceId: input.place.googlePlaceId ?? null,
    googleMapsUrl: input.place.mapsUrl ?? null,
    googleRating: input.place.rating ?? null,
    googlePrimaryType: null,
    photoName: input.place.photoName ?? null,
    photoReference: null,
    photoUrl: input.place.imageUrl ?? null,
    photoAttributions: input.place.photoAttributions ?? [],
    imageSource: input.place.imageSource,
    sortOrder: input.sortOrder,
    metadata: {
      type: input.place.type,
      statusChips: input.place.statusChips,
      sourceExploreId: input.place.id,
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function noteToExploreItem(input: {
  existingId?: string;
  tripId: string;
  userId: string;
  description: string;
}): TripExploreItem {
  const now = new Date().toISOString();
  return {
    id: input.existingId ?? cryptoRandomId(),
    tripId: input.tripId,
    createdBy: input.userId,
    itemType: 'note',
    title: 'Anteckningar',
    description: input.description,
    category: 'Anteckningar',
    placeName: null,
    formattedAddress: null,
    latitude: null,
    longitude: null,
    googlePlaceId: null,
    googleMapsUrl: null,
    googleRating: null,
    googlePrimaryType: null,
    photoName: null,
    photoReference: null,
    photoUrl: null,
    photoAttributions: [],
    imageSource: 'placeholder',
    sortOrder: 0,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

function normalizeExploreCategory(value: string | null): ExploreCategory {
  switch (value) {
    case 'Sevärdheter':
    case 'Restauranger':
    case 'Hotell':
    case 'Aktiviteter':
    case 'Egna tips':
      return value;
    default:
      return 'Egna tips';
  }
}

function normalizeNodeType(value: unknown): ExplorePlace['type'] {
  switch (value) {
    case 'lodging':
    case 'camping':
    case 'activity':
    case 'gastronomy':
    case 'fuel':
    case 'transport':
    case 'note':
    case 'custom':
      return value;
    default:
      return 'custom';
  }
}

function normalizeUuid(value: string): string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : cryptoRandomId();
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
