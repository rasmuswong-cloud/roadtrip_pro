import test from 'node:test';
import assert from 'node:assert/strict';

import type { ItineraryNode } from '../src/models';
import { estimateRouteSummary } from '../src/services/routing/routeEstimate';

function node(id: string, latitude: number, longitude: number): ItineraryNode {
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
    location: { latitude, longitude },
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

test('offline route estimates keep distance but do not expose straight-line map geometry', () => {
  const route = estimateRouteSummary([
    node('a', 55.605, 13.0038),
    node('b', 56.0, 14.0),
  ]);

  assert.equal(route.provider, 'offline');
  assert.ok(route.distanceMeters > 0);
  assert.equal(route.geometry, undefined);
});
