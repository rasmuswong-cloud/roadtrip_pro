import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addExplorePlaceTarget,
  emptyExploreState,
  explorePlaceFromGooglePlace,
  groupExplorePlaces,
  imageSourceForPlace,
  placeholderTypeForPlace,
  recommendedPlacesFromNodes,
  type ExplorePlace,
} from '../src/services/planning/exploreBoard';

function place(overrides: Partial<ExplorePlace> = {}): ExplorePlace {
  return {
    id: overrides.id ?? 'place-1',
    title: overrides.title ?? 'Museum',
    place: overrides.place ?? 'Main street',
    category: overrides.category ?? 'Sevärdheter',
    type: overrides.type ?? 'activity',
    coordinates: overrides.coordinates ?? { latitude: 59.3, longitude: 18 },
    imageSource: overrides.imageSource ?? 'placeholder',
    statusChips: overrides.statusChips ?? ['Kartposition klar'],
    ...overrides,
  };
}

test('empty explore state is explicit and grouping keeps categories stable', () => {
  assert.deepEqual(emptyExploreState([]), {
    isEmpty: true,
    message: 'Spara tips, restauranger och stopp här innan de hamnar i resplanen.',
  });

  const grouped = groupExplorePlaces([
    place({ id: 'food', category: 'Restauranger', type: 'gastronomy' }),
    place({ id: 'hotel', category: 'Hotell', type: 'lodging' }),
  ]);

  assert.equal(grouped.Restauranger.length, 1);
  assert.equal(grouped.Hotell.length, 1);
  assert.deepEqual(Object.keys(grouped), ['Sevärdheter', 'Restauranger', 'Hotell', 'Aktiviteter', 'Egna tips']);
});

test('google places map to safe explore cards with missing coordinate fallback', () => {
  const mapped = explorePlaceFromGooglePlace({
    id: 'abc',
    displayName: { text: 'Cafe Alpine' },
    formattedAddress: 'Via Roma',
    primaryType: 'restaurant',
    rating: 4.7,
    location: { latitude: Number.NaN, longitude: 11 },
  });

  assert.equal(mapped.id, 'google:abc');
  assert.equal(mapped.category, 'Restauranger');
  assert.equal(mapped.type, 'gastronomy');
  assert.equal(mapped.coordinates, null);
  assert.deepEqual(mapped.statusChips, ['Saknar kartposition']);
});

test('placeholder and image source selection are stable', () => {
  assert.equal(placeholderTypeForPlace(place({ type: 'lodging', category: 'Hotell' })), 'lodging');
  assert.equal(placeholderTypeForPlace(place({ type: 'gastronomy', category: 'Restauranger' })), 'food');
  assert.equal(placeholderTypeForPlace(place({ type: 'custom', category: 'Egna tips' })), 'notes-explore');
  assert.equal(imageSourceForPlace(place({ imageUrl: 'manual.jpg', imageSource: 'manual' })), 'manual');
  assert.equal(imageSourceForPlace(place({ photoName: 'places/1/photos/2', imageSource: 'google_place_photo' })), 'google_place_photo');
  assert.equal(imageSourceForPlace(place({ imageUrl: null, photoName: '', imageSource: 'placeholder' })), 'placeholder');
});

test('recommended places and add-place target are safe for invalid metadata', () => {
  const recommendations = recommendedPlacesFromNodes([{
    id: 'node-1',
    title: 'Hotel',
    type: 'lodging',
    startsAt: '2026-07-12T10:00:00.000Z',
    location: null,
    metadata: { place: 123 },
  }]);

  assert.equal(recommendations[0]?.category, 'Hotell');
  assert.equal(recommendations[0]?.place, '');
  assert.deepEqual(recommendations[0]?.statusChips, ['Saknar kartposition']);

  assert.equal(addExplorePlaceTarget(place(), null), null);
  assert.deepEqual(addExplorePlaceTarget(place(), '2026-07-12'), {
    view: 'days',
    dayKey: '2026-07-12',
    title: 'Museum',
    place: 'Main street',
    type: 'activity',
    latitude: '59.3',
    longitude: '18',
    notes: '',
  });
});
