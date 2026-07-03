import type { Coordinates, ItineraryNode, RouteSummary } from '@/models';
import { isPlaceholderStop } from '@/services/planning/placeholderStops';
import { formatDistance, formatDuration } from '@/utils/formatters';

export type MapMarkerData = {
  id: string;
  title: string;
  label: string;
  coordinates: Coordinates;
};

export type RouteLabelData = {
  id: string;
  label: string;
  coordinates: Coordinates;
};

export type MapViewport =
  | { state: 'empty'; center: null; bounds: null }
  | { state: 'single'; center: Coordinates; bounds: null }
  | { state: 'bounds'; center: Coordinates; bounds: { north: number; south: number; east: number; west: number } };

export const DEFAULT_MAP_CENTER: Coordinates = { latitude: 55.604981, longitude: 13.003822 };

export function hasRoadRouteGeometry(route?: RouteSummary | null): boolean {
  return extractRoutePathCoordinates(route).length > 1;
}

export function routeMapStatusText(input: {
  route?: RouteSummary | null;
  routeIsCalculated: boolean;
  skippedStopCount?: number;
  routableStopCount?: number;
}): string {
  const skippedText = input.skippedStopCount && input.skippedStopCount > 0
    ? ` ${input.skippedStopCount} stopp saknar position och hoppades över.`
    : '';

  if (hasRoadRouteGeometry(input.route)) {
    return `Körväg visas på kartan.${skippedText}`;
  }

  if (input.routeIsCalculated) {
    return `Google gav ingen vägdata - prova att uppdatera rutten.${skippedText}`;
  }

  if (input.routableStopCount !== undefined && input.routableStopCount < 2) {
    return 'Minst två stopp behöver kartposition för att visa körvägen.';
  }

  return `Beräkna rutt för att visa körvägen på kartan.${skippedText}`;
}

export function extractValidMapMarkers(nodes: ItineraryNode[]): MapMarkerData[] {
  return nodes
    .filter((node): node is ItineraryNode & { location: Coordinates } => !node.deletedAt && !isPlaceholderStop(node) && isValidCoordinate(node.location))
    .map((node, index) => ({
      id: node.id,
      title: markerTitle(node),
      label: String(index + 1),
      coordinates: node.location,
    }));
}

export function calculateMapViewport(markers: MapMarkerData[]): MapViewport {
  return calculateCoordinateViewport(markers.map((marker) => marker.coordinates));
}

export function calculateRouteAwareMapViewport(markers: MapMarkerData[], routePath: Coordinates[]): MapViewport {
  return calculateCoordinateViewport(routePath.length > 1 ? routePath : markers.map((marker) => marker.coordinates));
}

function calculateCoordinateViewport(coordinates: Coordinates[]): MapViewport {
  if (coordinates.length === 0) {
    return { state: 'empty', center: null, bounds: null };
  }

  if (coordinates.length === 1) {
    return { state: 'single', center: coordinates[0]!, bounds: null };
  }

  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const north = Math.max(...latitudes);
  const south = Math.min(...latitudes);
  const east = Math.max(...longitudes);
  const west = Math.min(...longitudes);

  return {
    state: 'bounds',
    center: {
      latitude: (north + south) / 2,
      longitude: (east + west) / 2,
    },
    bounds: { north, south, east, west },
  };
}

export function mapInitialCenter(viewport: MapViewport): Coordinates {
  return viewport.center ?? DEFAULT_MAP_CENTER;
}

export function extractRoutePathCoordinates(route?: RouteSummary | null): Coordinates[] {
  const coordinates = route?.geometry?.coordinates ?? [];
  return coordinates.reduce<Coordinates[]>((path, [longitude, latitude]) => {
    const point = { latitude, longitude };
    if (isValidCoordinate(point)) {
      path.push(point);
    }
    return path;
  }, []);
}

export function buildRouteDrivingLabels(route: RouteSummary | null | undefined, nodes: ItineraryNode[]): RouteLabelData[] {
  const legs = route?.legs ?? [];
  if (legs.length === 0) {
    return [];
  }

  const routePath = extractRoutePathCoordinates(route);
  if (routePath.length <= 1) {
    return [];
  }

  const markers = extractValidMapMarkers(nodes);
  if (markers.length !== legs.length + 1) {
    return [];
  }

  let consumedDistanceMeters = 0;

  return legs.reduce<RouteLabelData[]>((labels, leg, index) => {
    const from = markers[index];
    const to = markers[index + 1];
    if (!from || !to || leg.distanceMeters <= 0 || leg.durationSeconds <= 0) {
      return labels;
    }

    const midpoint = coordinateAtRouteDistance(routePath, consumedDistanceMeters + (leg.distanceMeters / 2));
    consumedDistanceMeters += leg.distanceMeters;

    if (!midpoint) {
      return labels;
    }

    labels.push({
      id: `${from.id}:${to.id}`,
      label: `Körning · ${formatDuration(leg.durationSeconds)} · ${formatDistance(leg.distanceMeters)}`,
      coordinates: midpoint,
    });

    return labels;
  }, []);
}

function isValidCoordinate(coordinates?: { latitude?: number | undefined; longitude?: number | undefined } | null): coordinates is Coordinates {
  const latitude = coordinates?.latitude;
  const longitude = coordinates?.longitude;

  return Boolean(
    Number.isFinite(latitude)
      && Number.isFinite(longitude)
      && latitude !== undefined
      && latitude >= -90
      && latitude <= 90
      && longitude !== undefined
      && longitude >= -180
      && longitude <= 180,
  );
}

function coordinateAtRouteDistance(path: Coordinates[], targetDistanceMeters: number): Coordinates | null {
  if (path.length === 0) {
    return null;
  }

  if (targetDistanceMeters <= 0) {
    return path[0] ?? null;
  }

  let traveledMeters = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index]!;
    const end = path[index + 1]!;
    const segmentMeters = distanceBetween(start, end);
    if (traveledMeters + segmentMeters >= targetDistanceMeters) {
      const ratio = segmentMeters === 0 ? 0 : (targetDistanceMeters - traveledMeters) / segmentMeters;
      return {
        latitude: start.latitude + ((end.latitude - start.latitude) * ratio),
        longitude: start.longitude + ((end.longitude - start.longitude) * ratio),
      };
    }

    traveledMeters += segmentMeters;
  }

  return path[path.length - 1] ?? null;
}

function distanceBetween(start: Coordinates, end: Coordinates): number {
  const earthRadiusMeters = 6_371_000;
  const startLatitude = toRadians(start.latitude);
  const endLatitude = toRadians(end.latitude);
  const deltaLatitude = toRadians(end.latitude - start.latitude);
  const deltaLongitude = toRadians(end.longitude - start.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * (Math.sin(deltaLongitude / 2) ** 2);
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function markerTitle(node: ItineraryNode): string {
  const place = typeof node.metadata.place === 'string' ? node.metadata.place.trim() : '';
  return place || node.title || 'Stopp';
}
