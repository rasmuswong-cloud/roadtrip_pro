import type { Coordinates, ItineraryNode, RouteLegSummary, RouteSummary } from '@/models';

const COMPUTE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const FIELD_MASK = 'routes.distanceMeters,routes.duration,routes.legs.distanceMeters,routes.legs.duration,routes.polyline.encodedPolyline';

export type GoogleRouteInput = {
  stops: ItineraryNode[];
};

export type GoogleRouteResult = {
  route: RouteSummary;
  includedStopCount: number;
  skippedStopCount: number;
};

type GoogleRoutesResponse = {
  routes?: Array<{
    distanceMeters?: number;
    duration?: string;
    legs?: Array<{
      distanceMeters?: number;
      duration?: string;
    }>;
    polyline?: {
      encodedPolyline?: string;
    };
  }>;
};

export function googleRoutesMissingApiKeyMessage(): string {
  return 'Google Routes är inte konfigurerat i den här miljön.';
}

export function getRoutableStops(stops: ItineraryNode[]): ItineraryNode[] {
  return stops.filter((stop) => isValidCoordinate(stop.location));
}

export function routeStopSignature(stops: ItineraryNode[]): string {
  return getRoutableStops(stops)
    .map((stop) => `${stop.id}:${stop.location!.latitude.toFixed(6)},${stop.location!.longitude.toFixed(6)}`)
    .join('|');
}

export async function calculateGoogleRoute(input: GoogleRouteInput): Promise<GoogleRouteResult> {
  const apiKey = resolveGoogleRoutesApiKey();
  if (!apiKey) {
    throw new Error(googleRoutesMissingApiKeyMessage());
  }

  const routableStops = getRoutableStops(input.stops);
  if (routableStops.length < 2) {
    throw new Error('Minst två stopp behöver kartposition.');
  }

  const coordinates = routableStops.map((stop) => stop.location!);
  const origin = coordinates[0]!;
  const destination = coordinates[coordinates.length - 1]!;
  const intermediates = coordinates.slice(1, -1);

  const response = await fetch(COMPUTE_ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      origin: waypointFromCoordinates(origin),
      destination: waypointFromCoordinates(destination),
      intermediates: intermediates.map(waypointFromCoordinates),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      units: 'METRIC',
      languageCode: 'sv-SE',
    }),
  });

  if (!response.ok) {
    throw new Error(await formatGoogleRoutesError(response));
  }

  const data = (await response.json()) as GoogleRoutesResponse;
  const route = data.routes?.[0];
  if (!route || typeof route.distanceMeters !== 'number') {
    throw new Error('Google Routes returnerade ingen körbar rutt.');
  }

  const routeLegs = buildRouteLegs(routableStops, route.legs);
  const routeGeometry = route.polyline?.encodedPolyline
    ? {
        type: 'LineString' as const,
        coordinates: decodePolyline(route.polyline.encodedPolyline).map((point) => [point.longitude, point.latitude]),
      }
    : undefined;
  const routeSummary: RouteSummary = {
    distanceMeters: route.distanceMeters,
    durationSeconds: parseDurationSeconds(route.duration),
    provider: 'google_routes',
    instructions: [],
  };

  if (routeGeometry) {
    routeSummary.geometry = routeGeometry;
  }

  if (routeLegs.length > 0) {
    routeSummary.legs = routeLegs;
  }

  return {
    route: routeSummary,
    includedStopCount: routableStops.length,
    skippedStopCount: input.stops.length - routableStops.length,
  };
}

function buildRouteLegs(
  stops: ItineraryNode[],
  legs: Array<{ distanceMeters?: number; duration?: string }> | undefined,
): RouteLegSummary[] {
  if (!legs || legs.length === 0) {
    return [];
  }

  return legs.reduce<RouteLegSummary[]>((routeLegs, leg, index) => {
    const fromStop = stops[index];
    const toStop = stops[index + 1];
    if (!fromStop || !toStop || typeof leg.distanceMeters !== 'number') {
      return routeLegs;
    }

    routeLegs.push({
      fromTitle: fromStop.title,
      toTitle: toStop.title,
      distanceMeters: leg.distanceMeters,
      durationSeconds: parseDurationSeconds(leg.duration),
      provider: 'google_routes',
    });

    return routeLegs;
  }, []);
}

function resolveGoogleRoutesApiKey(): string | undefined {
  return process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
}

function waypointFromCoordinates(coordinates: Coordinates) {
  return {
    location: {
      latLng: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      },
    },
  };
}

function isValidCoordinate(coordinates?: Coordinates | null): coordinates is Coordinates {
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

function parseDurationSeconds(value: string | undefined): number {
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value ?? '');
  return match ? Math.round(Number(match[1])) : 0;
}

async function formatGoogleRoutesError(response: Response): Promise<string> {
  let statusText = '';

  try {
    const data = (await response.json()) as { error?: { status?: unknown } };
    statusText = typeof data.error?.status === 'string' ? ` (${data.error.status})` : '';
  } catch {
    statusText = '';
  }

  return `Google Routes misslyckades med status ${response.status}${statusText}. Kontrollera att Routes API är aktiverat och att nyckelns browser/referrer-regler tillåter appens domän.`;
}

function decodePolyline(value: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < value.length) {
    const latitudeResult = decodePolylineValue(value, index);
    latitude += latitudeResult.delta;
    index = latitudeResult.nextIndex;

    const longitudeResult = decodePolylineValue(value, index);
    longitude += longitudeResult.delta;
    index = longitudeResult.nextIndex;

    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }

  return points;
}

function decodePolylineValue(value: string, startIndex: number): { delta: number; nextIndex: number } {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = 0;

  do {
    byte = value.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20 && index < value.length);

  return {
    delta: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}
