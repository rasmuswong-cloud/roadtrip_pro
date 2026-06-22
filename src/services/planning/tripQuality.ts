import type { ItineraryNode } from '@/models';

export type TripQualityCounts = {
  missingBookingCount: number;
  missingTimeCount: number;
  planningGapCount: number;
};

export function buildTripQualityCounts(nodes: ItineraryNode[]): TripQualityCounts {
  return {
    missingBookingCount: countMissingBookingReferences(nodes),
    missingTimeCount: countMissingTimes(nodes),
    planningGapCount: countPlanningGaps(nodes),
  };
}

export function countMissingBookingReferences(nodes: ItineraryNode[]): number {
  return nodes.filter((node) => (
    (node.type === 'lodging' || node.type === 'transport')
    && !hasText(node.reservation.reference)
  )).length;
}

export function countMissingTimes(nodes: ItineraryNode[]): number {
  return nodes.filter((node) => node.type !== 'note' && !isValidDateTimeValue(node.startsAt)).length;
}

export function countPlanningGaps(nodes: ItineraryNode[]): number {
  return nodes.filter((node) => {
    if (!hasText(node.title)) {
      return true;
    }

    return Boolean(node.startsAt) && !isValidDateTimeValue(node.startsAt);
  }).length;
}

export function isValidDateTimeValue(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp);
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}
