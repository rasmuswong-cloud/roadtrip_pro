import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode } from '../src/models';
import {
  formatBulkCoordinateSummary,
  getBulkCoordinateCandidates,
  summarizeBulkCoordinateOutcomes,
} from '../src/services/planning/bulkCoordinateUpdate';
import { applyGooglePlaceCoordinateUpdate } from '../src/services/planning/placeCoordinateUpdate';

function node(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  const now = '2026-06-11T09:00:00.000Z';
  return {
    id: overrides.id ?? 'node-1',
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: 'activity',
    title: overrides.title ?? 'Stop',
    startsAt: now,
    endsAt: '2026-06-11T10:00:00.000Z',
    timezone: 'Europe/Stockholm',
    location: null,
    sortOrder: 100,
    transportMode: 'driving',
    reservation: { reference: 'ABC-123' },
    equipment: [],
    facilities: {},
    metadata: { cost: '100', currency: 'SEK', bookingStatus: 'confirmed' },
    notes: 'Keep this note',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test('bulk coordinate candidates include only searchable stops missing coordinates', () => {
  const candidates = getBulkCoordinateCandidates([
    node({ id: 'missing-place', metadata: { place: 'Cortina', cost: '100' } }),
    node({ id: 'missing-title', title: 'Bolzano' }),
    node({ id: 'valid', location: { latitude: 46.49, longitude: 11.35 }, metadata: { place: 'Valid' } }),
    node({ id: 'blank', title: '   ', metadata: {} }),
  ]);

  assert.deepEqual(candidates.map((candidate) => candidate.node.id), ['missing-place', 'missing-title']);
  assert.deepEqual(candidates.map((candidate) => candidate.query), ['Cortina', 'Bolzano']);
});

test('bulk coordinate update helper preserves stop details when a place is applied', () => {
  const original = node({ metadata: { place: 'Cortina', cost: '450', currency: 'EUR', bookingStatus: 'confirmed' } });
  const updated = applyGooglePlaceCoordinateUpdate(original, {
    id: 'places/cortina',
    displayName: { text: 'Cortina d Ampezzo' },
    formattedAddress: 'Cortina d Ampezzo, Italy',
    location: { latitude: 46.5405, longitude: 12.1357 },
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
  assert.deepEqual(updated.location, { latitude: 46.5405, longitude: 12.1357 });
});

test('bulk coordinate summary handles no results and partial failures', () => {
  const summary = summarizeBulkCoordinateOutcomes(4, [
    { nodeId: 'a', status: 'updated' },
    { nodeId: 'b', status: 'updated' },
    { nodeId: 'c', status: 'not_found' },
    { nodeId: 'd', status: 'failed', message: 'network' },
  ]);

  assert.deepEqual(summary, { attempted: 4, updated: 2, notFound: 1, failed: 1 });
  assert.equal(formatBulkCoordinateSummary(summary), '2 stopp uppdaterades, 1 kunde inte hittas, 1 misslyckades.');
  assert.equal(formatBulkCoordinateSummary({ attempted: 0, updated: 0, notFound: 0, failed: 0 }), 'Inga stopp saknar sökbar kartposition.');
});
