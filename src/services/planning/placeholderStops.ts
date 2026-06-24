import type { ItineraryNode, ItineraryNodeType } from '@/models';
import type { GooglePlace } from '@/services/google/googlePlaces';
import { applyGooglePlaceCoordinateUpdate } from './placeCoordinateUpdate';

export type PlaceholderStopType = 'overnight' | 'break' | 'meal' | 'fuel' | 'unknown' | 'drive_time';
export type PlaceholderDriveTimeRange = '4-6h' | '6-8h' | '8-10h';
export type SmartStopType = 'lodging' | 'city' | 'highway' | 'meal_break' | 'camping_lodging';

export type PlaceholderMetadata = {
  isPlaceholder: true;
  placeholderType: PlaceholderStopType;
  placeholderIntent: string;
  preferredDriveTimeRange?: PlaceholderDriveTimeRange;
  unresolvedBetweenStopIds?: string[];
};

export type SmartStopOption = {
  id: SmartStopType;
  label: string;
  query: string;
  nodeType: ItineraryNodeType;
};

export type DriveTimeOption = {
  id: PlaceholderDriveTimeRange;
  label: string;
  searchBias: string;
};

export const PLACEHOLDER_TYPES: Array<{ id: PlaceholderStopType; label: string; title: string; nodeType: ItineraryNodeType }> = [
  { id: 'overnight', label: 'Övernattning', title: 'Övernattning', nodeType: 'lodging' },
  { id: 'break', label: 'Paus', title: 'Paus', nodeType: 'activity' },
  { id: 'meal', label: 'Matstopp', title: 'Matstopp', nodeType: 'gastronomy' },
  { id: 'fuel', label: 'Tankstopp', title: 'Tankstopp', nodeType: 'fuel' },
  { id: 'unknown', label: 'Okänt stopp', title: 'Okänt stopp', nodeType: 'custom' },
  { id: 'drive_time', label: 'Stopp efter 6-8 h', title: 'Stopp efter 6-8 h', nodeType: 'custom' },
];

export const SMART_DRIVE_TIME_OPTIONS: DriveTimeOption[] = [
  { id: '4-6h', label: '4-6 h', searchBias: 'after 4 to 6 hours driving' },
  { id: '6-8h', label: '6-8 h', searchBias: 'after 6 to 8 hours driving' },
  { id: '8-10h', label: '8-10 h', searchBias: 'after 8 to 10 hours driving' },
];

export const SMART_STOP_OPTIONS: SmartStopOption[] = [
  { id: 'lodging', label: 'Boende', query: 'hotel lodging', nodeType: 'lodging' },
  { id: 'city', label: 'Stad', query: 'city center', nodeType: 'activity' },
  { id: 'highway', label: 'Nära motorväg', query: 'highway rest stop', nodeType: 'transport' },
  { id: 'meal_break', label: 'Mat/paus', query: 'restaurant cafe rest stop', nodeType: 'gastronomy' },
  { id: 'camping_lodging', label: 'Camping/boende', query: 'camping hotel', nodeType: 'camping' },
];

export function isPlaceholderStop(node: ItineraryNode): boolean {
  return node.metadata.isPlaceholder === true;
}

export function unresolvedPlaceholderStops(nodes: ItineraryNode[]): ItineraryNode[] {
  return nodes.filter((node) => isPlaceholderStop(node) && !node.location);
}

export function routableStops(nodes: ItineraryNode[]): ItineraryNode[] {
  return nodes.filter((node) => !isPlaceholderStop(node) || Boolean(node.location));
}

export function placeholderStatusChips(node: ItineraryNode): string[] {
  if (!isPlaceholderStop(node)) {
    return [];
  }

  const chips = ['Placeholder', 'Planerat men inte bestämt'];
  if (!node.location) {
    chips.push('Saknar exakt plats');
  }

  const range = readDriveTimeRange(node);
  if (range) {
    chips.push(`Efter ${range.replace('-', '-')}`);
  }

  return chips;
}

export function placeholderIntent(node: ItineraryNode): string {
  return readString(node.metadata.placeholderIntent) || node.notes || 'Fyll med plats när du vet mer.';
}

export function readDriveTimeRange(node: ItineraryNode): PlaceholderDriveTimeRange | null {
  const value = node.metadata.preferredDriveTimeRange;
  return value === '4-6h' || value === '6-8h' || value === '8-10h' ? value : null;
}

export function placeholderMetadata(input: {
  type: PlaceholderStopType;
  intent?: string;
  preferredDriveTimeRange?: PlaceholderDriveTimeRange;
  betweenStopIds?: string[];
}): PlaceholderMetadata {
  const placeholderType = PLACEHOLDER_TYPES.find((type) => type.id === input.type) ?? PLACEHOLDER_TYPES[4]!;
  const metadata: PlaceholderMetadata = {
    isPlaceholder: true,
    placeholderType: placeholderType.id,
    placeholderIntent: input.intent?.trim() || placeholderType.label,
  };

  if (input.preferredDriveTimeRange) {
    metadata.preferredDriveTimeRange = input.preferredDriveTimeRange;
  }

  if (input.betweenStopIds?.length) {
    metadata.unresolvedBetweenStopIds = input.betweenStopIds;
  }

  return metadata;
}

export function fillPlaceholderWithGooglePlace(
  node: ItineraryNode,
  place: GooglePlace,
  poiId?: string | null,
  now = new Date().toISOString(),
): ItineraryNode {
  const updated = applyGooglePlaceCoordinateUpdate(node, place, poiId, now);
  const nextMetadata = { ...updated.metadata };
  delete nextMetadata.isPlaceholder;
  delete nextMetadata.placeholderType;
  delete nextMetadata.placeholderIntent;
  delete nextMetadata.preferredDriveTimeRange;
  delete nextMetadata.unresolvedBetweenStopIds;

  const title = place.displayName?.text?.trim() || updated.title;

  return {
    ...updated,
    title,
    metadata: nextMetadata,
  };
}

export function buildSmartStopQuery(input: {
  fromStop: ItineraryNode;
  toStop: ItineraryNode;
  driveTimeRange: PlaceholderDriveTimeRange;
  stopType: SmartStopType;
}): string {
  const stopOption = SMART_STOP_OPTIONS.find((option) => option.id === input.stopType) ?? SMART_STOP_OPTIONS[0]!;
  const driveOption = SMART_DRIVE_TIME_OPTIONS.find((option) => option.id === input.driveTimeRange) ?? SMART_DRIVE_TIME_OPTIONS[1]!;
  const fromPlace = readString(input.fromStop.metadata.place) || input.fromStop.title;
  const toPlace = readString(input.toStop.metadata.place) || input.toStop.title;
  return `${stopOption.query} between ${fromPlace} and ${toPlace} ${driveOption.searchBias}`;
}

export function midpointBetweenStops(fromStop: ItineraryNode, toStop: ItineraryNode) {
  if (!fromStop.location || !toStop.location) {
    return null;
  }

  return {
    latitude: (fromStop.location.latitude + toStop.location.latitude) / 2,
    longitude: (fromStop.location.longitude + toStop.location.longitude) / 2,
  };
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
