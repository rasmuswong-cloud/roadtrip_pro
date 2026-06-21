import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode } from '../src/models';
import { reseplanrareSeedRows } from '../src/data/reseplanrareSeed';
import { planReseplanrareImport } from '../src/services/planning/reseplanrareImport';

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
    location: null,
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

test('repeated Ladda resplan reuses sourceRow nodes even after coordinate source changed', () => {
  const existing = node({
    id: 'old-malmo',
    title: 'Malmö',
    metadata: { source: 'google_places', sourceRow: 1, coordinateSource: 'google_places' },
  });
  const plan = planReseplanrareImport([existing], reseplanrareSeedRows);

  assert.equal(plan.existingNodesBySourceRow.get(1)?.id, 'old-malmo');
  assert.deepEqual(plan.obsoleteNodes.map((candidate) => candidate.id), []);
});

test('repeated Ladda resplan marks duplicate and obsolete imported rows for cleanup', () => {
  const keep = node({ id: 'keep-row-1', metadata: { source: 'reseplanrare.xlsx', sourceRow: 1 } });
  const duplicate = node({ id: 'duplicate-row-1', metadata: { source: 'google_places', sourceRow: 1 } });
  const oldImportedWithoutRow = node({ id: 'old-import', metadata: { source: 'reseplanrare.xlsx' } });
  const custom = node({ id: 'custom', metadata: { source: 'manual' } });
  const plan = planReseplanrareImport([keep, duplicate, oldImportedWithoutRow, custom], reseplanrareSeedRows);

  assert.equal(plan.existingNodesBySourceRow.size, 1);
  assert.equal(plan.existingNodesBySourceRow.get(1)?.id, 'keep-row-1');
  assert.deepEqual(plan.obsoleteNodes.map((candidate) => candidate.id), ['duplicate-row-1', 'old-import']);
});
