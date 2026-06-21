import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode } from '../src/models';
import { DEFAULT_MAP_CENTER, calculateMapViewport, extractValidMapMarkers, mapInitialCenter } from '../src/components/map/mapData';

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
