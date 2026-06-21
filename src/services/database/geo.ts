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

    const ewkbPoint = parseEwkbPoint(value);
    if (ewkbPoint) {
      return ewkbPoint;
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

function parseEwkbPoint(value: string): Coordinates | null {
  if (!/^[0-9a-f]+$/i.test(value) || value.length < 42 || value.length % 2 !== 0) {
    return null;
  }

  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }

  const view = new DataView(bytes.buffer);
  const littleEndian = view.getUint8(0) === 1;
  const type = view.getUint32(1, littleEndian);
  const hasSrid = Boolean(type & 0x20000000);
  const geometryType = type & 0x000000ff;
  if (geometryType !== 1) {
    return null;
  }

  const coordinateOffset = hasSrid ? 9 : 5;
  if (bytes.length < coordinateOffset + 16) {
    return null;
  }

  const longitude = view.getFloat64(coordinateOffset, littleEndian);
  const latitude = view.getFloat64(coordinateOffset + 8, littleEndian);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { longitude, latitude };
}
