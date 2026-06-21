import type { Coordinates, ItineraryNode } from '@/models';

export type BulkCoordinateCandidate = {
  node: ItineraryNode;
  query: string;
};

export type BulkCoordinateOutcome = {
  nodeId: string;
  status: 'updated' | 'not_found' | 'failed';
  title?: string;
  step?: 'search' | 'save';
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

export function formatBulkCoordinateDiagnostics(outcomes: BulkCoordinateOutcome[], maxItems = 3): string | null {
  const failures = outcomes.filter((outcome) => outcome.status === 'failed' && outcome.message);
  if (failures.length === 0) {
    return null;
  }

  const details = failures.slice(0, maxItems).map((outcome) => {
    const title = outcome.title?.trim() || outcome.nodeId;
    const step = outcome.step === 'save' ? 'sparning' : 'sökning';
    return `${title}: ${step} - ${outcome.message}`;
  });
  const remaining = failures.length - details.length;

  return `Fel: ${details.join(' | ')}${remaining > 0 ? ` | +${remaining} till` : ''}`;
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
