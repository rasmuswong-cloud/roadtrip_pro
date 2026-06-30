import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode, RouteSummary } from '../src/models';
import {
  DEFAULT_MAP_CENTER,
  buildRouteDrivingLabels,
  calculateMapViewport,
  calculateRouteAwareMapViewport,
  extractRoutePathCoordinates,
  extractValidMapMarkers,
  mapInitialCenter,
} from '../src/components/map/mapData';

function node(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  const now = '2026-06-11T09:00:00.000Z';
  return {
    id: overrides.id ?? 'node-1',
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: 'activity',
    title: overrides.title ?? 'Stop',
    startsAt: now,
    endsAt: null,
    timezone: 'Europe/Stockholm',
    location: { latitude: 48.1374, longitude: 11.5755 },
    sortOrder: 100,
    transportMode: 'driving',
    reservation: {},
    equipment: [],
    facilities: {},
    metadata: {},
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

function route(overrides: Partial<RouteSummary> = {}): RouteSummary {
  return {
    distanceMeters: 3000,
    durationSeconds: 1200,
    provider: 'google_routes',
    legs: [
      {
        fromTitle: 'A',
        toTitle: 'B',
        distanceMeters: 3000,
        durationSeconds: 1200,
        provider: 'google_routes',
      },
    ],
    instructions: [],
    ...overrides,
  };
}

test('extractValidMapMarkers keeps valid coordinates and prepares labels', () => {
  const markers = extractValidMapMarkers([
    node({ id: 'a', title: 'Title A', metadata: { place: 'Place A' } }),
    node({ id: 'b', title: 'Title B', location: { latitude: 46.4983, longitude: 11.3548 } }),
  ]);

  assert.deepEqual(markers.map((marker) => marker.id), ['a', 'b']);
  assert.equal(markers[0]?.title, 'Place A');
  assert.equal(markers[1]?.title, 'Title B');
  assert.equal(markers[0]?.label, '1');
  assert.equal(markers[1]?.label, '2');
});

test('extractValidMapMarkers ignores missing and invalid coordinates', () => {
  const markers = extractValidMapMarkers([
    node({ id: 'missing', location: null }),
    node({ id: 'nan', location: { latitude: Number.NaN, longitude: 11 } }),
    node({ id: 'bad-lat', location: { latitude: 91, longitude: 11 } }),
    node({ id: 'bad-lng', location: { latitude: 48, longitude: 181 } }),
    node({ id: 'deleted', deletedAt: '2026-06-12T09:00:00.000Z', location: { latitude: 48, longitude: 11 } }),
    node({ id: 'valid', location: { latitude: 48, longitude: 11 } }),
  ]);

  assert.deepEqual(markers.map((marker) => marker.id), ['valid']);
  assert.deepEqual(markers.map((marker) => marker.label), ['1']);
});

test('extractValidMapMarkers numbers only visible mapped stops without gaps', () => {
  const markers = extractValidMapMarkers([
    node({ id: 'a', location: { latitude: 55, longitude: 13 } }),
    node({ id: 'missing', location: null }),
    node({ id: 'placeholder', location: { latitude: 56, longitude: 14 }, metadata: { isPlaceholder: true } }),
    node({ id: 'b', location: { latitude: 57, longitude: 15 } }),
    node({ id: 'c', location: { latitude: 58, longitude: 16 } }),
  ]);

  assert.deepEqual(markers.map((marker) => marker.id), ['a', 'b', 'c']);
  assert.deepEqual(markers.map((marker) => marker.label), ['1', '2', '3']);
});

test('calculateMapViewport reports empty, single center, and bounds states', () => {
  assert.deepEqual(calculateMapViewport([]), { state: 'empty', center: null, bounds: null });
  assert.deepEqual(mapInitialCenter(calculateMapViewport([])), DEFAULT_MAP_CENTER);

  const one = extractValidMapMarkers([node({ location: { latitude: 50, longitude: 14 } })]);
  assert.deepEqual(calculateMapViewport(one), {
    state: 'single',
    center: { latitude: 50, longitude: 14 },
    bounds: null,
  });
  assert.deepEqual(mapInitialCenter(calculateMapViewport(one)), { latitude: 50, longitude: 14 });

  const many = extractValidMapMarkers([
    node({ location: { latitude: 48, longitude: 11 } }),
    node({ location: { latitude: 46, longitude: 13 } }),
  ]);
  assert.deepEqual(calculateMapViewport(many), {
    state: 'bounds',
    center: { latitude: 47, longitude: 12 },
    bounds: { north: 48, south: 46, east: 13, west: 11 },
  });
});

test('calculateRouteAwareMapViewport fits route geometry before marker-only bounds', () => {
  const markers = extractValidMapMarkers([
    node({ id: 'a', location: { latitude: 55, longitude: 13 } }),
    node({ id: 'b', location: { latitude: 55.2, longitude: 13.2 } }),
  ]);
  const routePath = [
    { latitude: 55, longitude: 13 },
    { latitude: 47, longitude: 8 },
    { latitude: 44, longitude: 12 },
  ];

  assert.deepEqual(calculateRouteAwareMapViewport(markers, routePath), {
    state: 'bounds',
    center: { latitude: 49.5, longitude: 10.5 },
    bounds: { north: 55, south: 44, east: 13, west: 8 },
  });
});

test('extractRoutePathCoordinates converts route geometry to map coordinates only when geometry exists', () => {
  assert.deepEqual(extractRoutePathCoordinates(route()), []);

  assert.deepEqual(extractRoutePathCoordinates(route({
    geometry: {
      type: 'LineString',
      coordinates: [
        [13.0038, 55.605],
        [14.0, 56.0],
      ],
    },
  })), [
    { latitude: 55.605, longitude: 13.0038 },
    { latitude: 56.0, longitude: 14.0 },
  ]);
});

test('buildRouteDrivingLabels positions known route labels on route geometry', () => {
  const labels = buildRouteDrivingLabels(route({
    geometry: {
      type: 'LineString',
      coordinates: [
        [13, 55],
        [13, 55.03],
      ],
    },
  }), [
    node({ id: 'a', location: { latitude: 55, longitude: 13 } }),
    node({ id: 'b', location: { latitude: 55.03, longitude: 13 } }),
  ]);

  assert.equal(labels.length, 1);
  assert.equal(labels[0]?.approximate, false);
  assert.match(labels[0]?.label ?? '', /^Körning · 20 min · 3\.0 km$/);
  assert.ok((labels[0]?.coordinates.latitude ?? 0) > 55);
  assert.ok((labels[0]?.coordinates.latitude ?? 0) < 55.03);
  assert.equal(labels[0]?.coordinates.longitude, 13);
});

test('buildRouteDrivingLabels uses clearly approximate labels when geometry is missing', () => {
  const labels = buildRouteDrivingLabels(route(), [
    node({ id: 'a', location: { latitude: 55, longitude: 13 } }),
    node({ id: 'b', location: { latitude: 57, longitude: 15 } }),
  ]);

  assert.equal(labels.length, 1);
  assert.equal(labels[0]?.approximate, true);
  assert.equal(labels[0]?.label, 'Ungefärlig körning · 20 min · 3.0 km');
  assert.deepEqual(labels[0]?.coordinates, { latitude: 56, longitude: 14 });
});

test('buildRouteDrivingLabels skips labels when route legs do not safely match visible stops', () => {
  const labels = buildRouteDrivingLabels(route({
    legs: [
      { fromTitle: 'A', toTitle: 'B', distanceMeters: 1000, durationSeconds: 600, provider: 'google_routes' },
      { fromTitle: 'B', toTitle: 'C', distanceMeters: 1000, durationSeconds: 600, provider: 'google_routes' },
    ],
  }), [
    node({ id: 'a', location: { latitude: 55, longitude: 13 } }),
    node({ id: 'missing', location: null }),
    node({ id: 'c', location: { latitude: 57, longitude: 15 } }),
  ]);

  assert.deepEqual(labels, []);
});
