import type { Coordinates, Poi } from '@/models';

const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.primaryType',
  'places.googleMapsUri',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'places.regularOpeningHours',
].join(',');

export type GooglePlaceSearchInput = {
  query: string;
  center?: Coordinates;
  radiusMeters?: number;
  languageCode?: string;
  maxResultCount?: number;
};

export type GooglePlace = {
  id: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  primaryType?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: Record<string, unknown>;
};

type GooglePlacesResponse = {
  places?: GooglePlace[];
};

export async function searchGooglePlaces(input: GooglePlaceSearchInput): Promise<GooglePlace[]> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY.');
  }

  const body: Record<string, unknown> = {
    textQuery: input.query,
    languageCode: input.languageCode ?? 'en',
    maxResultCount: input.maxResultCount ?? 5,
  };

  if (input.center) {
    body.locationBias = {
      circle: {
        center: input.center,
        radius: input.radiusMeters ?? 20_000,
      },
    };
  }

  const response = await fetch(TEXT_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Google Places search failed with status ${response.status}.`);
  }

  const data = (await response.json()) as GooglePlacesResponse;
  return data.places ?? [];
}

export function googlePlaceToPoi(place: GooglePlace, tripId: string, actorId: string): Poi | null {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: stableGooglePoiId(place.id),
    tripId,
    createdBy: actorId,
    name: place.displayName?.text ?? 'Unnamed place',
    category: place.primaryType ?? 'poi',
    location: { latitude, longitude },
    address: place.formattedAddress ?? null,
    source: 'google_places',
    externalRef: place.id,
    rating: place.rating ?? null,
    openingHours: place.regularOpeningHours ?? {},
    contact: {
      googleMapsUri: place.googleMapsUri ?? '',
      websiteUri: place.websiteUri ?? '',
      phone: place.nationalPhoneNumber ?? '',
    },
    imagery: [],
    metadata: { provider: 'google_places_new' },
    isPrivate: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  };
}

function stableGooglePoiId(placeId: string): string {
  let hash = 0;
  for (let index = 0; index < placeId.length; index += 1) {
    hash = (hash * 31 + placeId.charCodeAt(index)) >>> 0;
  }

  return `00000000-0000-4000-8000-${hash.toString(16).padStart(12, '0').slice(0, 12)}`;
}
