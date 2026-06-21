import test from 'node:test';
import assert from 'node:assert/strict';

import type { ItineraryNode } from '../src/models';
import { buildMissingInfoChips, formatItineraryTime } from '../src/components/planning/dayCardViewModel';

function makeNode(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  return {
    id: 'node-1',
    tripId: 'trip-1',
    poiId: null,
    createdBy: 'user-1',
    type: 'lodging',
    title: 'Hotel',
    notes: null,
    startsAt: '2026-07-12T09:00:00.000Z',
    endsAt: null,
    timezone: 'Europe/Stockholm',
    location: { latitude: 55.6, longitude: 13.0 },
    sortOrder: 100,
    transportMode: 'driving',
    reservation: { reference: 'ABC123' },
    equipment: [],
    facilities: {},
    metadata: { cost: '1200' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test('day card time display uses a safe fallback for invalid or missing values', () => {
  assert.equal(formatItineraryTime(null), 'Tid saknas');
  assert.equal(formatItineraryTime(undefined), 'Tid saknas');
  assert.equal(formatItineraryTime('not-a-date'), 'Tid saknas');
});

test('day card missing info chips describe incomplete itinerary items', () => {
  const chips = buildMissingInfoChips(makeNode({
    startsAt: null,
    location: null,
    reservation: {},
    metadata: {},
  }));

  assert.deepEqual(chips, [
    'Tid saknas',
    'Kostnad saknas',
    'Bokningsreferens saknas',
    'Kartposition saknas',
  ]);
});

test('day card missing info chips stay empty for complete itinerary items', () => {
  assert.deepEqual(buildMissingInfoChips(makeNode()), []);
});
