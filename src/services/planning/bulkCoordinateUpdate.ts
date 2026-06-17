import type { Coordinates, ItineraryNode } from '@/models';

export type BulkCoordinateCandidate = {
  node: ItineraryNode;
  query: string;
};

export type BulkCoordinateOutcome = {
  nodeId: string;
  status: 'updated' | 'not_found' | 'failed';
  message?: string;
};

export type BulkCoordinateSummary = {
  attempted: number;
  updated: number;
  notFound: number;
  failed: number;
};

export function getBulkCoordinateCandidates(nodes: ItineraryNode[]): BulkCoordinateCandidate[] {
  return nodes.flatMap((node) => {
    const query = coordinateSearchText(node);
    if (hasValidCoordinates(node.location) || !query) {
      return [];
    }

    return [{ node, query }];
  });
}

export function summarizeBulkCoordinateOutcomes(attempted: number, outcomes: BulkCoordinateOutcome[]): BulkCoordinateSummary {
  return {
    attempted,
    updated: outcomes.filter((outcome) => outcome.status === 'updated').length,
    notFound: outcomes.filter((outcome) => outcome.status === 'not_found').length,
    failed: outcomes.filter((outcome) => outcome.status === 'failed').length,
  };
}

export function formatBulkCoordinateSummary(summary: BulkCoordinateSummary): string {
  if (summary.attempted === 0) {
    return 'Inga stopp saknar sökbar kartposition.';
  }

  const parts = [`${summary.updated} stopp uppdaterades`];
  if (summary.notFound > 0) {
    parts.push(`${summary.notFound} kunde inte hittas`);
  }
  if (summary.failed > 0) {
    parts.push(`${summary.failed} misslyckades`);
  }

  return parts.join(', ') + '.';
}

function coordinateSearchText(node: ItineraryNode): string {
  const place = typeof node.metadata.place === 'string' ? node.metadata.place.trim() : '';
  const address = typeof node.metadata.address === 'string' ? node.metadata.address.trim() : '';
  return place || address || node.title.trim();
}

function hasValidCoordinates(coordinates?: Coordinates | null): boolean {
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
