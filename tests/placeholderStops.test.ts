import test from 'node:test';
import assert from 'node:assert/strict';
import type { ItineraryNode } from '../src/models';
import {
  buildSmartStopQuery,
  fillPlaceholderWithGooglePlace,
  isPlaceholderStop,
  midpointBetweenStops,
  placeholderMetadata,
  placeholderStatusChips,
  routableStops,
  unresolvedPlaceholderStops,
} from '../src/services/planning/placeholderStops';

function node(overrides: Partial<ItineraryNode> = {}): ItineraryNode {
  return {
    id: overrides.id ?? 'node-1',
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: overrides.type ?? 'lodging',
    title: overrides.title ?? 'Övernattning',
    startsAt: overrides.startsAt ?? '2026-07-12T09:00:00.000Z',
    endsAt: null,
    timezone: 'Europe/Rome',
    location: overrides.location ?? null,
    sortOrder: overrides.sortOrder ?? 100,
    transportMode: 'driving',
    reservation: {},
    equipment: [],
    facilities: {},
    notes: overrides.notes ?? null,
    metadata: overrides.metadata ?? {},
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    version: 1,
    ...overrides,
  };
}

test('placeholder metadata marks unresolved stops without requiring coordinates', () => {
  const placeholder = node({
    metadata: {
      ...placeholderMetadata({
        type: 'overnight',
        intent: 'Sov någonstans mellan Malmö och München',
        preferredDriveTimeRange: '6-8h',
        betweenStopIds: ['malmo', 'munich'],
      }),
    },
  });

  assert.equal(isPlaceholderStop(placeholder), true);
  assert.deepEqual(unresolvedPlaceholderStops([placeholder]).map((item) => item.id), ['node-1']);
  assert.deepEqual(placeholderStatusChips(placeholder), [
    'Placeholder',
    'Planerat men inte bestämt',
    'Saknar exakt plats',
    'Efter 6-8h',
  ]);
});

test('routable stop helper skips only unresolved placeholders', () => {
  const start = node({ id: 'start', title: 'Malmö', location: { latitude: 55.605, longitude: 13.0038 } });
  const placeholder = node({ id: 'placeholder', metadata: placeholderMetadata({ type: 'overnight' }), location: null });
  const filledPlaceholder = node({
    id: 'filled',
    metadata: placeholderMetadata({ type: 'overnight' }),
    location: { latitude: 50, longitude: 11 },
  });

  assert.deepEqual(routableStops([start, placeholder, filledPlaceholder]).map((item) => item.id), ['start', 'filled']);
});

test('smart stop query and midpoint use from and to stops', () => {
  const fromStop = node({ title: 'Malmö', location: { latitude: 55, longitude: 13 }, metadata: { place: 'Malmö' } });
  const toStop = node({ title: 'München', location: { latitude: 48, longitude: 11 }, metadata: { place: 'München' } });

  assert.equal(midpointBetweenStops(fromStop, toStop)?.latitude, 51.5);
  assert.match(buildSmartStopQuery({
    fromStop,
    toStop,
    driveTimeRange: '6-8h',
    stopType: 'camping_lodging',
  }), /camping hotel between Malmö and München after 6 to 8 hours driving/);
});

test('filling placeholder with Google place removes placeholder metadata and saves coordinates', () => {
  const placeholder = node({
    metadata: placeholderMetadata({ type: 'overnight', preferredDriveTimeRange: '6-8h' }),
  });

  const filled = fillPlaceholderWithGooglePlace(placeholder, {
    id: 'places/jena',
    displayName: { text: 'Jena' },
    formattedAddress: 'Jena, Germany',
    location: { latitude: 50.927, longitude: 11.589 },
    primaryType: 'locality',
    googleMapsUri: 'https://maps.google.com/?cid=1',
  }, 'poi-1', '2026-01-02T00:00:00.000Z');

  assert.equal(filled.title, 'Jena');
  assert.equal(filled.location?.latitude, 50.927);
  assert.equal(filled.metadata.isPlaceholder, undefined);
  assert.equal(filled.metadata.googlePlaceId, 'places/jena');
  assert.equal(filled.poiId, 'poi-1');
});
