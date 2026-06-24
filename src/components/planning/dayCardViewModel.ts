import type { ItineraryNode } from '@/models';

export function formatDistance(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1).replace('.0', '')} km`;
  }

  return `${Math.round(value)} m`;
}

export function formatDuration(value: number): string {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }

  return `${minutes} min`;
}

export function formatSek(value: number): string {
  return `${Math.round(value).toLocaleString('sv-SE')} SEK`;
}

export function formatItineraryTime(value?: string | null): string {
  if (!value) {
    return 'Tid saknas';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Tid saknas';
  }

  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatRawNodeCost(node: ItineraryNode): string {
  const cost = node.metadata.costSek ?? node.metadata.cost ?? node.metadata.price;
  if (typeof cost === 'number') {
    return String(cost);
  }

  if (typeof cost === 'string') {
    return cost;
  }

  return '';
}

export function cleanImportedNoteLines(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const cleanedLines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !isImportedNoteLine(line));

  return cleanedLines.length > 0 ? cleanedLines.join('\n') : null;
}

export function compactNote(value?: string | null): string | null {
  const cleaned = cleanImportedNoteLines(value);
  if (!cleaned) {
    return null;
  }

  return cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
}

export function nodeColor(type: ItineraryNode['type']): string {
  switch (type) {
    case 'camping':
      return '#059669';
    case 'activity':
      return '#d97706';
    case 'lodging':
      return '#2563eb';
    default:
      return '#0f766e';
  }
}

export function buildMissingInfoChips(node: ItineraryNode): string[] {
  const chips: string[] = [];

  if (!node.startsAt || Number.isNaN(new Date(node.startsAt).getTime())) {
    chips.push('Tid saknas');
  }

  if (!readNodeCost(node)) {
    chips.push('Kostnad saknas');
  }

  if ((node.type === 'lodging' || node.type === 'camping') && !node.reservation.reference && !node.reservation.provider) {
    chips.push('Bokningsreferens saknas');
  }

  if (!node.location) {
    chips.push('Kartposition saknas');
  }

  return chips;
}

export function coordinateStatusLabel(node: ItineraryNode): string | null {
  if (!node.location) {
    return null;
  }

  return shouldShowStaleCoordinateWarning(node) ? null : 'Position klar';
}

export function shouldShowStaleCoordinateWarning(node: ItineraryNode): boolean {
  if (!node.location) {
    return false;
  }

  const visiblePlace = readString(node.metadata.place);
  const coordinatePlaceLabel = readString(node.metadata.coordinatePlaceLabel);

  if (!visiblePlace || !coordinatePlaceLabel) {
    return false;
  }

  return normalizePlaceText(visiblePlace) !== normalizePlaceText(coordinatePlaceLabel);
}

function isImportedNoteLine(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('imported from')
    || normalized.includes('cost from')
    || normalized.includes('excel')
    || normalized.includes('reseplanrare')
    || normalized.includes('laddad fr')
    || normalized.includes('kostnad fr')
  );
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePlaceText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function readNodeCost(node: ItineraryNode): string {
  const cost = node.metadata.costSek ?? node.metadata.cost ?? node.metadata.price;
  if (typeof cost === 'number') {
    return String(cost);
  }

  if (typeof cost === 'string') {
    return cost;
  }

  return '';
}
