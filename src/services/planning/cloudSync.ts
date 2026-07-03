import type { ItineraryNode } from '@/models';
import type { ExplorePlace } from './exploreBoard';

export function prepareItineraryNodeForActiveTripSave(
  node: ItineraryNode,
  tripId: string,
  userId: string,
  now = new Date().toISOString(),
): ItineraryNode {
  return {
    ...node,
    tripId,
    createdBy: node.createdBy || userId,
    updatedBy: userId,
    updatedAt: node.updatedAt || now,
  };
}

export function prepareLocalNodeForCloud(node: ItineraryNode, tripId: string, userId: string, index: number, now = new Date().toISOString()): ItineraryNode {
  return {
    ...cloneItineraryNode(node),
    id: isUuid(node.id) ? node.id : cryptoRandomId(),
    tripId,
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    sortOrder: Number.isFinite(node.sortOrder) ? node.sortOrder : (index + 1) * 100,
  };
}

export function buildItineraryNodeDuplicateKey(node: ItineraryNode): string {
  const place = typeof node.metadata.place === 'string' ? node.metadata.place : '';
  const latitude = Number.isFinite(node.location?.latitude) ? node.location!.latitude.toFixed(5) : '';
  const longitude = Number.isFinite(node.location?.longitude) ? node.location!.longitude.toFixed(5) : '';
  return [
    normalizeDuplicateText(node.title),
    node.type,
    node.startsAt ?? '',
    normalizeDuplicateText(place),
    latitude,
    longitude,
  ].join('|');
}

export function buildExplorePlaceDuplicateKey(place: ExplorePlace): string {
  const latitude = Number.isFinite(place.coordinates?.latitude) ? place.coordinates!.latitude.toFixed(5) : '';
  const longitude = Number.isFinite(place.coordinates?.longitude) ? place.coordinates!.longitude.toFixed(5) : '';
  return [
    normalizeDuplicateText(place.title),
    normalizeDuplicateText(place.place ?? ''),
    place.googlePlaceId ?? '',
    latitude,
    longitude,
  ].join('|');
}

function cloneItineraryNode(node: ItineraryNode): ItineraryNode {
  return JSON.parse(JSON.stringify(node)) as ItineraryNode;
}

function normalizeDuplicateText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
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
