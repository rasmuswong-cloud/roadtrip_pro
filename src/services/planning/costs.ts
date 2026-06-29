import type { ItineraryNode } from '@/models';

const rawCostKeys = ['costSek', 'cost', 'price'] as const;
const detailedCostKeys = ['lodgingCostSek', 'activityCostSek'] as const;

export function parseCostValue(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  if (/^\s*-/.test(value)) {
    return 0;
  }

  const parts = value.split('+');
  return parts.reduce((sum, part) => sum + parseCostPart(part), 0);
}

export function hasKnownCostValue(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0;
  }

  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed || /^\s*-/.test(trimmed)) {
    return false;
  }

  const parsed = parseCostValue(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 && /\d/.test(trimmed);
}

export function hasKnownNodeCost(node: ItineraryNode): boolean {
  return [...rawCostKeys, ...detailedCostKeys].some((key) => hasKnownCostValue(node.metadata[key]));
}

export function hasKnownDetailedNodeCost(node: ItineraryNode): boolean {
  return detailedCostKeys.some((key) => hasKnownCostValue(node.metadata[key]));
}

export function hasKnownRawNodeCost(node: ItineraryNode): boolean {
  return rawCostKeys.some((key) => hasKnownCostValue(node.metadata[key]));
}

export function formatKnownCostLabel(value: string): string {
  return parseCostValue(value) === 0 ? 'Gratis' : value;
}

function parseCostPart(value: string): number {
  const matches = value.replace(',', '.').match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) {
    return 0;
  }

  const numbers = matches.map(Number).filter(Number.isFinite);
  if (value.includes('-') && numbers.length >= 2) {
    const [low = 0, high = 0] = numbers;
    return (low + high) / 2;
  }

  return numbers.reduce((sum, number) => sum + number, 0);
}
