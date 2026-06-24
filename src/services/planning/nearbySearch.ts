import type { Coordinates, ItineraryNode } from '@/models';
import type { GooglePlace, GooglePlaceSearchInput } from '@/services/google/googlePlaces';
import { explorePlaceFromGooglePlace, type ExplorePlace } from './exploreBoard';

export type NearbyCategoryId =
  | 'restaurants'
  | 'parking'
  | 'fuel'
  | 'grocery'
  | 'attractions'
  | 'swimming'
  | 'camping_lodging';

export type NearbyCategory = {
  id: NearbyCategoryId;
  label: string;
  query: string;
};

export type NearbySearchContext = {
  id: string;
  label: string;
  detail: string;
  center: Coordinates;
};

export type NearbyDayContext = {
  key: string;
  title: string;
  nodes: ItineraryNode[];
};

export const NEARBY_CATEGORIES: NearbyCategory[] = [
  { id: 'restaurants', label: 'Restauranger', query: 'restaurant' },
  { id: 'parking', label: 'Parkering', query: 'parking' },
  { id: 'fuel', label: 'Bensinstation', query: 'gas station' },
  { id: 'grocery', label: 'Mataffär', query: 'grocery store' },
  { id: 'attractions', label: 'Sevärdheter', query: 'tourist attraction' },
  { id: 'swimming', label: 'Badplats', query: 'swimming' },
  { id: 'camping_lodging', label: 'Camping/boende', query: 'camping hotel' },
];

export function buildNearbySearchInput(input: {
  category: NearbyCategory;
  context: NearbySearchContext;
  radiusMeters?: number;
  maxResultCount?: number;
}): GooglePlaceSearchInput {
  return {
    query: input.category.query,
    center: input.context.center,
    radiusMeters: input.radiusMeters ?? 20_000,
    languageCode: 'sv',
    maxResultCount: input.maxResultCount ?? 8,
  };
}

export function buildNearbySearchContexts(input: {
  dayContexts: NearbyDayContext[];
  selectedDayKey: string | null;
  stops: ItineraryNode[];
}): NearbySearchContext[] {
  const contexts: NearbySearchContext[] = [];
  const selectedDay = input.dayContexts.find((day) => day.key === input.selectedDayKey);
  const selectedDayCenter = selectedDay ? centerForNodes(selectedDay.nodes) : null;

  if (selectedDay && selectedDayCenter) {
    contexts.push({
      id: `day:${selectedDay.key}`,
      label: `Vald dag: ${selectedDay.title}`,
      detail: `${selectedDay.nodes.filter((node) => node.location).length} stopp med position`,
      center: selectedDayCenter,
    });
  }

  input.stops.forEach((stop) => {
    if (!stop.location) {
      return;
    }

    contexts.push({
      id: `stop:${stop.id}`,
      label: stop.title || 'Stopp',
      detail: stop.metadata.place && typeof stop.metadata.place === 'string' ? stop.metadata.place : 'Stopp med kartposition',
      center: stop.location,
    });
  });

  const firstLocatedStop = input.stops.find((stop) => stop.location);
  if (firstLocatedStop?.location && !contexts.some((context) => context.id === `stop:${firstLocatedStop.id}`)) {
    contexts.push({
      id: `stop:${firstLocatedStop.id}`,
      label: firstLocatedStop.title || 'Första stoppet',
      detail: 'Första stoppet med kartposition',
      center: firstLocatedStop.location,
    });
  }

  return contexts;
}

export function nearbyExplorePlaceFromGooglePlace(place: GooglePlace, center: Coordinates): ExplorePlace {
  const explorePlace = explorePlaceFromGooglePlace(place);
  const distanceMeters = distanceBetweenCoordinates(center, explorePlace.coordinates ?? null);
  const distanceChip = distanceMeters === null ? null : `${formatNearbyDistance(distanceMeters)} bort`;

  return {
    ...explorePlace,
    statusChips: [distanceChip, ...explorePlace.statusChips].filter((chip): chip is string => Boolean(chip)).slice(0, 3),
  };
}

export function distanceBetweenCoordinates(origin: Coordinates, target: Coordinates | null | undefined): number | null {
  if (!target) {
    return null;
  }

  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(target.latitude - origin.latitude);
  const longitudeDelta = toRadians(target.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const targetLatitude = toRadians(target.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(targetLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function formatNearbyDistance(distanceMeters: number): string {
  return distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toLocaleString('sv-SE', { maximumFractionDigits: 1 })} km`
    : `${Math.round(distanceMeters / 50) * 50} m`;
}

function centerForNodes(nodes: ItineraryNode[]): Coordinates | null {
  const locatedNodes = nodes.filter((node): node is ItineraryNode & { location: Coordinates } => Boolean(node.location));
  if (locatedNodes.length === 0) {
    return null;
  }

  return {
    latitude: locatedNodes.reduce((sum, node) => sum + node.location.latitude, 0) / locatedNodes.length,
    longitude: locatedNodes.reduce((sum, node) => sum + node.location.longitude, 0) / locatedNodes.length,
  };
}

function toRadians(value: number): number {
  return value * (Math.PI / 180);
}
