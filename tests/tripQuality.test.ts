import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode } from '../src/models';
import {
  buildTripQualityCounts,
  countMissingBookingReferences,
  countMissingTimes,
  countPlanningGaps,
  isValidDateTimeValue,
} from '../src/services/planning/tripQuality';

function node(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  const now = '2026-06-11T10:00:00.000Z';
  return {
    id: overrides.id ?? 'node-1',
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: overrides.type ?? 'activity',
    title: overrides.title ?? 'Stop',
    startsAt: overrides.startsAt ?? now,
    endsAt: overrides.endsAt ?? null,
    timezone: 'Europe/Stockholm',
    location: overrides.location ?? { latitude: 59.3, longitude: 18.0 },
    sortOrder: overrides.sortOrder ?? 100,
    transportMode: 'driving',
    reservation: overrides.reservation ?? {},
    equipment: [],
    facilities: {},
    metadata: overrides.metadata ?? {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test('empty trip quality counts are safe zeroes', () => {
  assert.deepEqual(buildTripQualityCounts([]), {
    missingBookingCount: 0,
    missingTimeCount: 0,
    planningGapCount: 0,
  });
});

test('missing info detection counts bookings, times, and planning gaps', () => {
  const nodes = [
    node({ id: 'hotel', type: 'lodging', reservation: {}, startsAt: '2026-06-11T15:00:00.000Z' }),
    node({ id: 'train', type: 'transport', reservation: { reference: 'SJ123' }, startsAt: null }),
    node({ id: 'bad-date', startsAt: 'not-a-date' }),
    node({ id: 'blank', title: '   ', startsAt: '2026-06-12T10:00:00.000Z' }),
    node({ id: 'note', type: 'note', startsAt: null }),
  ];

  assert.equal(countMissingBookingReferences(nodes), 1);
  assert.equal(countMissingTimes(nodes), 2);
  assert.equal(countPlanningGaps(nodes), 2);
});

test('missing and invalid dates are detected without flagging notes as missing time', () => {
  const nodes = [
    node({ id: 'bad-date', startsAt: 'not-a-date' }),
    node({ id: 'missing-date', startsAt: null }),
    node({ id: 'note', type: 'note', startsAt: null }),
  ];

  assert.equal(isValidDateTimeValue('2026-06-11T10:00:00.000Z'), true);
  assert.equal(isValidDateTimeValue('not-a-date'), false);
  assert.equal(isValidDateTimeValue(null), false);
  assert.equal(countMissingTimes(nodes), 2);
  assert.equal(countPlanningGaps(nodes), 1);
});
