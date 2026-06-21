import type { Coordinates, ItineraryNode } from '@/models';

export type MapMarkerData = {
  id: string;
  title: string;
  label: string;
  coordinates: Coordinates;
};

export type MapViewport =
  | { state: 'empty'; center: null; bounds: null }
  | { state: 'single'; center: Coordinates; bounds: null }
  | { state: 'bounds'; center: Coordinates; bounds: { north: number; south: number; east: number; west: number } };

export const DEFAULT_MAP_CENTER: Coordinates = { latitude: 55.604981, longitude: 13.003822 };

export function extractValidMapMarkers(nodes: ItineraryNode[]): MapMarkerData[] {
  return nodes
    .filter((node): node is ItineraryNode & { location: Coordinates } => !node.deletedAt && isValidCoordinate(node.location))
    .map((node, index) => ({
      id: node.id,
      title: markerTitle(node),
      label: String(index + 1),
      coordinates: node.location,
    }));
}

export function calculateMapViewport(markers: MapMarkerData[]): MapViewport {
  if (markers.length === 0) {
    return { state: 'empty', center: null, bounds: null };
  }

  if (markers.length === 1) {
    return { state: 'single', center: markers[0]!.coordinates, bounds: null };
  }

  const latitudes = markers.map((marker) => marker.coordinates.latitude);
  const longitudes = markers.map((marker) => marker.coordinates.longitude);
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

function isValidCoordinate(coordinates?: Coordinates | null): coordinates is Coordinates {
  return Boolean(
    coordinates
      && Number.isFinite(coordinates.latitude)
      && Number.isFinite(coordinates.longitude)
      && coordinates.latitude >= -90
      && coordinates.latitude <= 90
      && coordinates.longitude >= -180
      && coordinates.longitude <= 180,
  );
}

function markerTitle(node: ItineraryNode): string {
  const place = typeof node.metadata.place === 'string' ? node.metadata.place.trim() : '';
  return place || node.title || 'Stopp';
}
