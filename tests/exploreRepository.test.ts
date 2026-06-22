import test from 'node:test';
import assert from 'node:assert/strict';
import {
  explorePlaceFromItem,
  explorePlaceToItem,
  noteToExploreItem,
  tripExploreItemFromRow,
  tripExploreItemToRow,
  type TripExploreItem,
} from '../src/services/database/exploreMappers';
import type { TripExploreItemRow } from '../src/services/database/rows';
import type { ExplorePlace } from '../src/services/planning/exploreBoard';

function row(overrides: Partial<TripExploreItemRow> = {}): TripExploreItemRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    trip_id: 'trip-1',
    created_by: 'user-1',
    item_type: 'place',
    title: 'Cafe',
    description: 'Good lunch',
    category: 'Restauranger',
    place_name: 'Cafe',
    formatted_address: 'Via Roma',
    latitude: 46.5,
    longitude: 11.7,
    google_place_id: 'places/cafe',
    google_maps_url: 'https://maps.example',
    google_rating: 4.6,
    google_primary_type: 'restaurant',
    photo_name: 'places/cafe/photos/1',
    photo_reference: null,
    photo_url: null,
    photo_attributions: [{ displayName: 'Google' }],
    image_source: 'google_place_photo',
    sort_order: 100,
    metadata: { type: 'gastronomy' },
    created_at: '2026-06-22T10:00:00.000Z',
    updated_at: '2026-06-22T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function item(overrides: Partial<TripExploreItem> = {}): TripExploreItem {
  return tripExploreItemFromRow(row(overrides as Partial<TripExploreItemRow>));
}

test('trip explore row mapper preserves Google metadata and coordinates', () => {
  const mapped = tripExploreItemFromRow(row());

  assert.equal(mapped.googlePlaceId, 'places/cafe');
  assert.equal(mapped.latitude, 46.5);
  assert.equal(mapped.longitude, 11.7);
  assert.deepEqual(mapped.photoAttributions, [{ displayName: 'Google' }]);
  assert.deepEqual(tripExploreItemToRow(mapped).metadata, { type: 'gastronomy' });
});

test('explore place conversion handles invalid metadata and missing coordinates safely', () => {
  const place = explorePlaceFromItem(item({
    latitude: null,
    longitude: null,
    metadata: { type: 'not-a-node-type' },
    category: 'Unknown',
  }));

  assert.equal(place?.category, 'Egna tips');
  assert.equal(place?.type, 'custom');
  assert.equal(place?.coordinates, null);
  assert.deepEqual(place?.statusChips, ['Saknar kartposition']);
});

test('explore place to item stores safe metadata and generated ids for external candidates', () => {
  const place: ExplorePlace = {
    id: 'google:abc',
    title: 'Museum',
    place: 'Main street',
    category: 'Sevärdheter',
    type: 'activity',
    coordinates: { latitude: 59.3, longitude: 18 },
    imageSource: 'placeholder',
    statusChips: ['Kartposition klar'],
  };

  const saved = explorePlaceToItem({ place, tripId: 'trip-1', userId: 'user-1', sortOrder: 10 });

  assert.match(saved.id, /^[0-9a-f-]{36}$/i);
  assert.equal(saved.itemType, 'place');
  assert.equal(saved.metadata.type, 'activity');
  assert.equal(saved.latitude, 59.3);
});

test('note item reuses existing id and keeps text for failed retry paths', () => {
  const note = noteToExploreItem({
    existingId: '11111111-1111-4111-8111-111111111111',
    tripId: 'trip-1',
    userId: 'user-1',
    description: 'Parking link',
  });

  assert.equal(note.id, '11111111-1111-4111-8111-111111111111');
  assert.equal(note.itemType, 'note');
  assert.equal(note.description, 'Parking link');
});
