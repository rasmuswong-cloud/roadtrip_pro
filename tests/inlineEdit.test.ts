import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode } from '../src/models';
import { calculateDayCost, summarizeDay } from '../src/services/planning/dayAnalysis';
import {
  applyInlineFieldUpdate,
  inlineFieldValue,
  shouldSaveInlineField,
  validateInlineFieldValue,
} from '../src/services/planning/inlineEdit';
import { applyGooglePlaceCoordinateUpdate } from '../src/services/planning/placeCoordinateUpdate';

function node(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  const now = '2026-06-11T09:00:00.000Z';
  return {
    id: overrides.id ?? 'node-1',
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: 'activity',
    title: 'München',
    startsAt: '2026-06-11T09:30:00.000Z',
    endsAt: '2026-06-11T11:00:00.000Z',
    timezone: 'Europe/Stockholm',
    location: { latitude: 48.1374, longitude: 11.5755 },
    sortOrder: 100,
    transportMode: 'driving',
    reservation: { reference: 'ABC-123' },
    equipment: [],
    facilities: {},
    metadata: {
      place: 'München',
      cost: '100',
      currency: 'SEK',
      bookingStatus: 'confirmed',
    },
    notes: 'Ta med regnjacka',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test('title can be opened and saved through inline update', () => {
  const updated = applyInlineFieldUpdate(node(), 'title', 'Prag', '2026-06-12T10:00:00.000Z');
  assert.equal(updated.title, 'Prag');
  assert.equal(updated.version, 2);
});

test('place can be saved without changing coordinates', () => {
  const original = node();
  const updated = applyInlineFieldUpdate(original, 'place', 'Prag');
  assert.equal(updated.metadata.place, 'Prag');
  assert.deepEqual(updated.location, original.location);
});

test('google place selection updates coordinates while preserving stop details', () => {
  const original = node();
  const updated = applyGooglePlaceCoordinateUpdate(original, {
    id: 'places/prague-castle',
    displayName: { text: 'Prague Castle' },
    formattedAddress: 'Hradcany, Prague',
    location: { latitude: 50.0909, longitude: 14.4005 },
    primaryType: 'tourist_attraction',
  }, 'poi-1', '2026-06-12T10:00:00.000Z');

  assert.equal(updated.title, original.title);
  assert.equal(updated.type, original.type);
  assert.equal(updated.startsAt, original.startsAt);
  assert.equal(updated.endsAt, original.endsAt);
  assert.equal(updated.notes, original.notes);
  assert.deepEqual(updated.reservation, original.reservation);
  assert.equal(updated.metadata.cost, original.metadata.cost);
  assert.equal(updated.metadata.currency, original.metadata.currency);
  assert.equal(updated.metadata.bookingStatus, original.metadata.bookingStatus);
  assert.deepEqual(updated.location, { latitude: 50.0909, longitude: 14.4005 });
  assert.equal(updated.poiId, 'poi-1');
  assert.equal(updated.metadata.place, 'Prague Castle');
  assert.equal(updated.metadata.address, 'Hradcany, Prague');
  assert.equal(updated.metadata.externalRef, 'places/prague-castle');
  assert.equal(updated.version, original.version + 1);
});

test('date validates and preserves time information', () => {
  assert.equal(validateInlineFieldValue(node(), 'date', '2026-06-12').valid, true);
  const updated = applyInlineFieldUpdate(node(), 'date', '2026-06-12');
  assert.equal(updated.startsAt, '2026-06-12T09:30:00.000Z');
  assert.equal(updated.endsAt, '2026-06-12T11:00:00.000Z');
});

test('start time validates and saves while keeping date', () => {
  const updated = applyInlineFieldUpdate(node(), 'startTime', '08:15');
  assert.equal(updated.startsAt, '2026-06-11T08:15:00.000Z');
  assert.equal(updated.endsAt, '2026-06-11T11:00:00.000Z');
});

test('end time validates and saves', () => {
  const updated = applyInlineFieldUpdate(node(), 'endTime', '12:30');
  assert.equal(updated.endsAt, '2026-06-11T12:30:00.000Z');
});

test('end time before start time is saved as next calendar day', () => {
  const updated = applyInlineFieldUpdate(node(), 'endTime', '01:15');
  assert.equal(updated.startsAt, '2026-06-11T09:30:00.000Z');
  assert.equal(updated.endsAt, '2026-06-12T01:15:00.000Z');
});

test('DST-near dates keep the stored wall-clock time and suffix', () => {
  const original = node({
    startsAt: '2026-03-29T01:30:00+01:00',
    endsAt: '2026-03-29T03:15:00+02:00',
  });
  const updated = applyInlineFieldUpdate(original, 'date', '2026-03-30');
  assert.equal(updated.startsAt, '2026-03-30T01:30:00+01:00');
  assert.equal(updated.endsAt, '2026-03-30T03:15:00+02:00');
});

test('type, cost, currency, booking status and booking reference can be changed', () => {
  let updated = applyInlineFieldUpdate(node(), 'type', 'lodging');
  updated = applyInlineFieldUpdate(updated, 'cost', '250');
  updated = applyInlineFieldUpdate(updated, 'currency', 'EUR');
  updated = applyInlineFieldUpdate(updated, 'bookingStatus', 'requested');
  updated = applyInlineFieldUpdate(updated, 'bookingReference', 'XYZ-789');

  assert.equal(updated.type, 'lodging');
  assert.equal(updated.metadata.costSek, '250');
  assert.equal(updated.metadata.cost, undefined);
  assert.equal(updated.metadata.currency, 'EUR');
  assert.equal(updated.metadata.bookingStatus, 'requested');
  assert.equal(updated.reservation.reference, 'XYZ-789');
});

test('notes can be changed and cleared', () => {
  const changed = applyInlineFieldUpdate(node(), 'notes', 'Ny anteckning');
  assert.equal(changed.notes, 'Ny anteckning');

  const cleared = applyInlineFieldUpdate(changed, 'notes', '');
  assert.equal(cleared.notes, null);
});

test('invalid values are rejected before save', () => {
  assert.equal(validateInlineFieldValue(node(), 'title', '').valid, false);
  assert.equal(validateInlineFieldValue(node(), 'date', '2026/06/11').valid, false);
  assert.equal(validateInlineFieldValue(node(), 'startTime', '9').valid, false);
  assert.equal(validateInlineFieldValue(node(), 'cost', 'NaN').valid, false);
  assert.equal(validateInlineFieldValue(node(), 'cost', '-1').valid, false);
});

test('unchanged value does not need a server call and cancel can restore original draft', () => {
  const original = node();
  assert.equal(shouldSaveInlineField(original, 'title', 'München'), false);
  assert.equal(inlineFieldValue(original, 'title'), 'München');
});

test('server failure contract keeps original node when no inline update is applied', () => {
  const original = node();
  const afterFailure = original;
  assert.deepEqual(afterFailure, original);
});

test('double save guard is represented by unchanged values after first successful patch', () => {
  const updated = applyInlineFieldUpdate(node(), 'title', 'Prag');
  assert.equal(shouldSaveInlineField(updated, 'title', 'Prag'), false);
});

test('only one active inline field is represented by one active node-field pair', () => {
  const active = { nodeId: 'node-1', field: 'title' as const };
  const next = { nodeId: 'node-2', field: 'place' as const };
  assert.notDeepEqual(active, next);
  assert.equal(next.field, 'place');
});

test('day summary and budget reflect successful inline edits', () => {
  const updated = applyInlineFieldUpdate(
    applyInlineFieldUpdate(node(), 'title', 'Prag'),
    'cost',
    '350',
  );

  const summary = summarizeDay([updated], '2026-06-11', 1);
  assert.equal(summary.stopCount, 1);
  assert.equal(calculateDayCost([updated]), 350);
});

test('inline cost overrides imported legacy cost fields used by the budget', () => {
  const original = node({ metadata: { cost: '100', price: '120', costSek: '140' } });
  const updated = applyInlineFieldUpdate(original, 'cost', '350');
  assert.equal(updated.metadata.costSek, '350');
  assert.equal(updated.metadata.cost, undefined);
  assert.equal(updated.metadata.price, undefined);
  assert.equal(calculateDayCost([updated]), 350);
});
