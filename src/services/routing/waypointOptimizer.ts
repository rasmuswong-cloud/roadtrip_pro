import type { Coordinates, ItineraryNode } from '@/models';

export type OptimizedWaypointPlan = {
  nodes: ItineraryNode[];
  distanceMeters: number;
};

export function optimizeWaypointOrder(nodes: ItineraryNode[]): OptimizedWaypointPlan {
  const routable = nodes.filter((node) => node.location);
  const fixed = nodes.filter((node) => !node.location);

  if (routable.length < 3) {
    return { nodes, distanceMeters: pathDistanceMeters(routable) };
  }

  const nearest = nearestNeighbor(routable);
  const improved = twoOpt(nearest);

  return {
    nodes: [...improved, ...fixed].map((node, index) => ({ ...node, sortOrder: (index + 1) * 10 })),
    distanceMeters: pathDistanceMeters(improved),
  };
}

function nearestNeighbor(nodes: ItineraryNode[]): ItineraryNode[] {
  const [start, ...rest] = nodes;
  if (!start) {
    return [];
  }

  const ordered = [start];
  const unvisited = [...rest];

  while (unvisited.length > 0) {
    const current = ordered[ordered.length - 1]!;
    const nextIndex = findNearestIndex(current.location!, unvisited);
    ordered.push(unvisited.splice(nextIndex, 1)[0]!);
  }

  return ordered;
}

function findNearestIndex(origin: Coordinates, candidates: ItineraryNode[]): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate, index) => {
    const distance = haversineMeters(origin, candidate.location!);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function twoOpt(nodes: ItineraryNode[]): ItineraryNode[] {
  let best = [...nodes];
  let improved = true;

  while (improved) {
    improved = false;

    for (let i = 1; i < best.length - 2; i += 1) {
      for (let k = i + 1; k < best.length - 1; k += 1) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)];
        if (pathDistanceMeters(candidate) < pathDistanceMeters(best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }

  return best;
}

function pathDistanceMeters(nodes: ItineraryNode[]): number {
  return nodes.reduce((sum, node, index) => {
    const next = nodes[index + 1];
    if (!node.location || !next?.location) {
      return sum;
    }

    return sum + haversineMeters(node.location, next.location);
  }, 0);
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
