import test from 'node:test';
import assert from 'node:assert/strict';

import type { ItineraryNode } from '../src/models';
import {
  calculateGoogleRoute,
  getRoutableStops,
  googleRoutesMissingApiKeyMessage,
  routeStopSignature,
} from '../src/services/google/googleRoutes';

const originalFetch = globalThis.fetch;
const originalPlacesKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const originalMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

function restoreEnvironment() {
  globalThis.fetch = originalFetch;
  if (originalPlacesKey === undefined) {
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  } else {
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = originalPlacesKey;
  }
  if (originalMapsKey === undefined) {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  } else {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalMapsKey;
  }
}

function node(id: string, latitude?: number, longitude?: number): ItineraryNode {
  const now = '2026-06-11T09:00:00.000Z';
  return {
    id,
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: 'activity',
    title: id,
    startsAt: now,
    endsAt: null,
    timezone: 'Europe/Stockholm',
    location: latitude === undefined || longitude === undefined ? null : { latitude, longitude },
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
  };
}

test('Google Routes calculation is explicit and uses saved stop coordinates', async () => {
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = 'routes-key-for-test';
  delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  let requestedBody: Record<string, unknown> = {};
  let usedKey = '';
  globalThis.fetch = (async (_url, init) => {
    usedKey = (init?.headers as Record<string, string>)['X-Goog-Api-Key'];
    requestedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      routes: [{
        distanceMeters: 123456,
        duration: '5432s',
        legs: [
          { distanceMeters: 50000, duration: '2000s' },
          { distanceMeters: 73456, duration: '3432s' },
        ],
        polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const result = await calculateGoogleRoute({
      stops: [
        node('a', 55.605, 13.0038),
        node('missing'),
        node('b', 56.0, 14.0),
        node('c', 57.0, 15.0),
      ],
    });

    assert.equal(usedKey, 'routes-key-for-test');
    assert.equal(result.route.provider, 'google_routes');
    assert.equal(result.route.distanceMeters, 123456);
    assert.equal(result.route.durationSeconds, 5432);
    assert.equal(result.includedStopCount, 3);
    assert.equal(result.skippedStopCount, 1);
    assert.equal((requestedBody.intermediates as unknown[]).length, 1);
    assert.equal(result.route.geometry?.coordinates.length, 3);
    assert.deepEqual(result.route.legs?.map((leg) => `${leg.fromTitle}->${leg.toTitle}:${leg.distanceMeters}`), [
      'a->b:50000',
      'b->c:73456',
    ]);
  } finally {
    restoreEnvironment();
  }
});

test('Google Routes reports missing configuration before network calls', async () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response('{}');
  }) as typeof fetch;

  try {
    await assert.rejects(
      calculateGoogleRoute({ stops: [node('a', 55, 13), node('b', 56, 14)] }),
      new RegExp(googleRoutesMissingApiKeyMessage()),
    );
    assert.equal(called, false);
  } finally {
    restoreEnvironment();
  }
});

test('route helpers count routable stops and build a stable coordinate signature', () => {
  const stops = [node('a', 55, 13), node('b'), node('c', 56, 14)];

  assert.deepEqual(getRoutableStops(stops).map((stop) => stop.id), ['a', 'c']);
  assert.equal(routeStopSignature(stops), 'a:55.000000,13.000000|c:56.000000,14.000000');
});
