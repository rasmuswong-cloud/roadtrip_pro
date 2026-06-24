import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode } from '../src/models';
import {
  buildNearbySearchContexts,
  buildNearbySearchInput,
  distanceBetweenCoordinates,
  formatNearbyDistance,
  nearbyExplorePlaceFromGooglePlace,
  NEARBY_CATEGORIES,
} from '../src/services/planning/nearbySearch';

function node(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  return {
    id: overrides.id ?? 'node-1',
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: overrides.type ?? 'activity',
    title: overrides.title ?? 'Malmö',
    startsAt: overrides.startsAt ?? '2026-07-12T09:00:00.000Z',
    location: overrides.location ?? { latitude: 55.605, longitude: 13.0038 },
    sortOrder: overrides.sortOrder ?? 100,
    reservation: {},
    equipment: [],
    facilities: {},
    metadata: overrides.metadata ?? { place: 'Malmö C' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test('nearby search contexts prioritize selected day and stops with coordinates', () => {
  const contexts = buildNearbySearchContexts({
    dayContexts: [{
      key: '2026-07-12',
      title: 'Dag 1',
      nodes: [
        node({ id: 'a', location: { latitude: 55, longitude: 13 } }),
        node({ id: 'b', location: { latitude: 57, longitude: 15 } }),
      ],
    }],
    selectedDayKey: '2026-07-12',
    stops: [
      node({ id: 'a', title: 'Start', location: { latitude: 55, longitude: 13 } }),
      node({ id: 'missing', title: 'No map', location: null }),
    ],
  });

  assert.equal(contexts[0]?.id, 'day:2026-07-12');
  assert.deepEqual(contexts[0]?.center, { latitude: 56, longitude: 14 });
  assert.equal(contexts.some((context) => context.id === 'stop:a'), true);
  assert.equal(contexts.some((context) => context.id === 'stop:missing'), false);
});

test('nearby search input uses category query and selected center without network calls', () => {
  const category = NEARBY_CATEGORIES.find((candidate) => candidate.id === 'fuel');
  assert.ok(category);

  const input = buildNearbySearchInput({
    category,
    context: {
      id: 'stop:1',
      label: 'Malmö',
      detail: 'Stopp',
      center: { latitude: 55.605, longitude: 13.0038 },
    },
  });

  assert.equal(input.query, 'gas station');
  assert.equal(input.languageCode, 'sv');
  assert.equal(input.radiusMeters, 20_000);
  assert.deepEqual(input.center, { latitude: 55.605, longitude: 13.0038 });
});

test('nearby place mapping adds a calm distance chip when coordinates exist', () => {
  const mapped = nearbyExplorePlaceFromGooglePlace({
    id: 'places/cafe',
    displayName: { text: 'Cafe nära' },
    formattedAddress: 'Storgatan 1',
    primaryType: 'restaurant',
    rating: 4.5,
    location: { latitude: 55.606, longitude: 13.004 },
  }, { latitude: 55.605, longitude: 13.0038 });

  assert.equal(mapped.title, 'Cafe nära');
  assert.equal(mapped.category, 'Restauranger');
  assert.match(mapped.statusChips[0] ?? '', /m bort$/);
});

test('nearby distance helpers handle kilometers and missing targets', () => {
  assert.equal(distanceBetweenCoordinates({ latitude: 0, longitude: 0 }, null), null);
  assert.equal(formatNearbyDistance(150), '150 m');
  assert.equal(formatNearbyDistance(12_300), '12,3 km');
});
