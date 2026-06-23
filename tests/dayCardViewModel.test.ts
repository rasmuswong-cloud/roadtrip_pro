import test from 'node:test';
import assert from 'node:assert/strict';

import type { ItineraryNode } from '../src/models';
import {
  buildMissingInfoChips,
  cleanImportedNoteLines,
  compactNote,
  formatDistance,
  formatDuration,
  formatItineraryTime,
  formatRawNodeCost,
  formatSek,
  nodeColor,
} from '../src/components/planning/dayCardViewModel';

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

test('day card route and currency formatters keep existing labels', () => {
  assert.equal(formatDistance(900), '900 m');
  assert.equal(formatDistance(1250), '1.3 km');
  assert.equal(formatDistance(12_500), '13 km');
  assert.equal(formatDuration(45 * 60), '45 min');
  assert.equal(formatDuration((2 * 3600) + (15 * 60)), '2 h 15 min');
  assert.equal(formatSek(12345.4), '12 345 SEK');
});

test('day card raw cost formatter reads imported cost metadata', () => {
  assert.equal(formatRawNodeCost(makeNode({ metadata: { costSek: 1500 } })), '1500');
  assert.equal(formatRawNodeCost(makeNode({ metadata: { cost: '1200 SEK' } })), '1200 SEK');
  assert.equal(formatRawNodeCost(makeNode({ metadata: { price: '99' } })), '99');
  assert.equal(formatRawNodeCost(makeNode({ metadata: {} })), '');
});

test('day card note helpers remove imported bookkeeping lines and compact long notes', () => {
  assert.equal(cleanImportedNoteLines('Imported from Excel\nKom ihåg passen\nCost from row 4'), 'Kom ihåg passen');
  assert.equal(cleanImportedNoteLines('Excel\nReseplanrare'), null);
  assert.equal(compactNote('Kort anteckning'), 'Kort anteckning');
  assert.equal(compactNote('x'.repeat(130)), `${'x'.repeat(117)}...`);
});

test('day card node colors remain stable by stop type', () => {
  assert.equal(nodeColor('camping'), '#059669');
  assert.equal(nodeColor('activity'), '#d97706');
  assert.equal(nodeColor('lodging'), '#2563eb');
  assert.equal(nodeColor('custom'), '#0f766e');
});
