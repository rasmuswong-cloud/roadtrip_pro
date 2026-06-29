import test from 'node:test';
import assert from 'node:assert/strict';

import type { ItineraryNode } from '../src/models';
import {
  buildExplorePlaceDuplicateKey,
  buildItineraryNodeDuplicateKey,
  prepareLocalNodeForCloud,
} from '../src/services/planning/cloudSync';
import type { ExplorePlace } from '../src/services/planning/exploreBoard';

function localNode(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  const now = '2026-06-29T10:00:00.000Z';
  return {
    id: 'local-current-roadtrip-row-33',
    tripId: 'local-current-roadtrip',
    createdBy: 'local-import',
    type: 'custom',
    title: 'Como/Lugano/Maggiore',
    startsAt: '2026-07-22T09:00:00.000Z',
    endsAt: null,
    timezone: 'Europe/Rome',
    location: null,
    sortOrder: 3300,
    transportMode: 'driving',
    reservation: { provider: 'Hotel alla Posta' },
    equipment: [],
    facilities: {},
    notes: 'Placeholder: Välj exakt område eller övernattning runt Como, Lugano eller Maggiore.',
    metadata: {
      source: 'current-roadtrip-plan',
      sourceRow: 33,
      place: 'Como, Lugano or Lake Maggiore',
      hotel: 'Hotel alla Posta',
      lodgingCostSek: '4625',
      costSek: '4625',
      isPlaceholder: true,
      placeholderType: 'unknown',
      placeholderIntent: 'Välj exakt område eller övernattning runt Como, Lugano eller Maggiore.',
      preferredDriveTimeRange: '4-6h',
    },
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 4,
    ...overrides,
  };
}

test('local imported stops convert into Supabase upsertable nodes without losing trip metadata', () => {
  const cloudNode = prepareLocalNodeForCloud(localNode(), 'trip-cloud', 'user-cloud', 0, '2026-06-29T12:00:00.000Z');

  assert.equal(cloudNode.tripId, 'trip-cloud');
  assert.equal(cloudNode.createdBy, 'user-cloud');
  assert.equal(cloudNode.updatedBy, 'user-cloud');
  assert.equal(cloudNode.deletedAt, null);
  assert.equal(cloudNode.version, 1);
  assert.equal(cloudNode.startsAt, '2026-07-22T09:00:00.000Z');
  assert.equal(cloudNode.reservation.provider, 'Hotel alla Posta');
  assert.equal(cloudNode.metadata.source, 'current-roadtrip-plan');
  assert.equal(cloudNode.metadata.sourceRow, 33);
  assert.equal(cloudNode.metadata.costSek, '4625');
  assert.equal(cloudNode.metadata.isPlaceholder, true);
  assert.equal(cloudNode.metadata.placeholderType, 'unknown');
  assert.equal(cloudNode.metadata.preferredDriveTimeRange, '4-6h');
  assert.equal(cloudNode.notes, 'Placeholder: Välj exakt område eller övernattning runt Como, Lugano eller Maggiore.');
});

test('local cloud sync duplicate keys match imported stops with equivalent saved cloud rows', () => {
  const local = localNode({ id: 'local-row-1' });
  const cloud = localNode({
    id: 'cloud-row-1',
    tripId: 'trip-cloud',
    createdBy: 'user-cloud',
    updatedBy: 'user-cloud',
    version: 1,
  });

  assert.equal(buildItineraryNodeDuplicateKey(local), buildItineraryNodeDuplicateKey(cloud));
});

test('explore place duplicate keys use title, place, google id and coordinates', () => {
  const place: ExplorePlace = {
    id: 'local-place',
    title: 'QA Cafe',
    description: null,
    category: 'Mat',
    place: 'QA Cafe, Malmö',
    coordinates: { latitude: 55.604981, longitude: 13.003822 },
    googlePlaceId: 'google-place-1',
    googleMapsUrl: null,
    rating: 4.5,
    primaryType: 'restaurant',
    photoName: null,
    photoReference: null,
    photoUrl: null,
    photoAttributions: [],
    imageSource: 'placeholder',
    statusChips: [],
    metadata: {},
  };
  const samePlace = { ...place, id: 'cloud-place' };

  assert.equal(buildExplorePlaceDuplicateKey(place), buildExplorePlaceDuplicateKey(samePlace));
  assert.notEqual(buildExplorePlaceDuplicateKey(place), buildExplorePlaceDuplicateKey({ ...place, googlePlaceId: 'other' }));
});
