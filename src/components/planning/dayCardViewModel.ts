import type { ItineraryNode } from '@/models';

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
