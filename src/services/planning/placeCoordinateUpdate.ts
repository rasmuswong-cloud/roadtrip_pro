import type { ItineraryNode } from '@/models';
import type { GooglePlace } from '@/services/google/googlePlaces';

export function applyGooglePlaceCoordinateUpdate(
  node: ItineraryNode,
  place: GooglePlace,
  poiId?: string | null,
  now = new Date().toISOString(),
): ItineraryNode {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    throw new Error('Den valda platsen saknar koordinater.');
  }

  const nextMetadata = { ...node.metadata };
  const placeName = place.displayName?.text?.trim() || place.formattedAddress?.trim();

  if (placeName) {
    nextMetadata.place = placeName;
  }

  if (place.formattedAddress?.trim()) {
    nextMetadata.address = place.formattedAddress.trim();
  }

  if (typeof nextMetadata.source !== 'string' || !nextMetadata.source.trim()) {
    nextMetadata.source = 'google_places';
  }
  nextMetadata.coordinateSource = 'google_places';
  if (placeName) {
    nextMetadata.coordinatePlaceLabel = placeName;
  }
  nextMetadata.externalRef = place.id;

  return {
    ...node,
    poiId: poiId ?? node.poiId ?? null,
    location: { latitude, longitude },
    metadata: nextMetadata,
    updatedAt: now,
    version: node.version + 1,
  };
}
