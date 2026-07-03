import test from 'node:test';
import assert from 'node:assert/strict';

import type { ItineraryNode } from '../src/models';
import {
  ACTIVE_CLOUD_TRIP_ID_KEY,
  clearPersistedActiveCloudTripId,
  persistActiveCloudTripId,
  readPersistedActiveCloudTripId,
  shortenTripId,
  tripRoleLabel,
} from '../src/services/sharing/activeCloudTrip';
import { prepareItineraryNodeForActiveTripSave } from '../src/services/planning/cloudSync';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function node(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  const now = '2026-07-03T10:00:00.000Z';
  return {
    id: 'node-1',
    tripId: 'personal-trip',
    createdBy: 'owner-user',
    updatedBy: null,
    type: 'custom',
    title: 'Shared stop',
    startsAt: null,
    endsAt: null,
    timezone: null,
    location: null,
    sortOrder: 10,
    transportMode: 'driving',
    reservation: {},
    equipment: [],
    facilities: {},
    metadata: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test('invite join can persist the active shared trip id for reload', () => {
  const storage = new MemoryStorage();

  persistActiveCloudTripId('shared-trip-123', storage);

  assert.equal(storage.getItem(ACTIVE_CLOUD_TRIP_ID_KEY), 'shared-trip-123');
  assert.equal(readPersistedActiveCloudTripId(storage), 'shared-trip-123');
});

test('shared trip remains active until explicitly cleared', () => {
  const storage = new MemoryStorage();
  persistActiveCloudTripId('shared-trip-123', storage);

  clearPersistedActiveCloudTripId(storage);

  assert.equal(readPersistedActiveCloudTripId(storage), null);
});

test('save operations are normalized to the active shared trip id', () => {
  const savedNode = prepareItineraryNodeForActiveTripSave(
    node({ tripId: 'stale-personal-trip', updatedBy: 'someone-else', metadata: { parkingCostSek: '120' } }),
    'shared-trip-123',
    'editor-user',
    '2026-07-03T12:00:00.000Z',
  );

  assert.equal(savedNode.tripId, 'shared-trip-123');
  assert.equal(savedNode.createdBy, 'owner-user');
  assert.equal(savedNode.updatedBy, 'editor-user');
  assert.equal(savedNode.metadata.parkingCostSek, '120');
});

test('member and owner debug labels expose only short non-secret trip status', () => {
  assert.equal(shortenTripId('12345678-90ab-cdef'), '12345678...');
  assert.equal(tripRoleLabel('owner'), 'ägare');
  assert.equal(tripRoleLabel('editor'), 'redigerare');
});
