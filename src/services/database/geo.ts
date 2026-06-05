import type { Coordinates } from '@/models';

export function parsePostgisPoint(value: unknown): Coordinates | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'object' && 'coordinates' in value) {
    const coordinates = (value as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coordinates) && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
      return { longitude: coordinates[0], latitude: coordinates[1] };
    }
  }

  if (typeof value === 'string') {
    const match = value.match(/POINT\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)/);
    if (match?.[1] && match[2]) {
      return { longitude: Number(match[1]), latitude: Number(match[2]) };
    }
  }

  return null;
}

export function toPostgisPoint(coordinates?: Coordinates | null): string | null {
  if (!coordinates) {
    return null;
  }

  return `SRID=4326;POINT(${coordinates.longitude} ${coordinates.latitude})`;
}
