import type { Coordinates, ItineraryNode, RouteSummary } from '@/models';

export function estimateRouteSummary(nodes: ItineraryNode[]): RouteSummary {
  const routableNodes = nodes.filter((node) => node.location);
  const distanceMeters = routableNodes.reduce((sum, node, index) => {
    const next = routableNodes[index + 1];
    if (!node.location || !next?.location) {
      return sum;
    }

    return sum + haversineMeters(node.location, next.location);
  }, 0);

  const summary: RouteSummary = {
    distanceMeters,
    durationSeconds: Math.round(distanceMeters / 22),
    provider: 'offline',
    instructions: [],
  };

  return summary;
}

function haversineMeters(a: Coordinates, b: Coordinates): number {
  const earthRadiusMeters = 6_371_000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}
