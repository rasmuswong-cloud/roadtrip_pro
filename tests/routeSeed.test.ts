import test from 'node:test';
import assert from 'node:assert/strict';
import { reseplanrareSeedRows } from '../src/data/reseplanrareSeed';
import { extractValidMapMarkers } from '../src/components/map/mapData';
import type { ItineraryNode } from '../src/models';

test('corrected roadtrip seed keeps the expected ordered stops with coordinates', () => {
  assert.deepEqual(
    reseplanrareSeedRows.map((row) => row.title ?? row.activity ?? row.hotel ?? row.place),
    [
      'Malmö',
      'Eventhotel Ö-Cappuccino',
      'Wyndham Garden Munich Messe',
      'Partnachklamm',
      'Gasthof Ködnitzhof',
      'Hotel alla Posta',
      'Caorle',
      'Hotel Mondial',
      'Montecchio Emilia',
    ],
  );

  assert.equal(reseplanrareSeedRows.length, 9);
  assert.equal(new Set(reseplanrareSeedRows.map((row) => row.sourceRow)).size, 9);
  assert.ok(reseplanrareSeedRows.every((row) => Number.isFinite(row.location?.latitude) && Number.isFinite(row.location?.longitude)));
});

test('hotel seed rows keep address as place metadata source', () => {
  const hotelAllaPosta = reseplanrareSeedRows.find((row) => row.hotel === 'Hotel alla Posta');
  assert.equal(hotelAllaPosta?.place, 'Piazza O. Dogliani, 19, 32023 Caprile BL, Italy');
  assert.match(hotelAllaPosta?.notes ?? '', /booking@hotelposta\.com/);
  assert.equal(hotelAllaPosta?.website, 'https://www.hotelposta.com/');
});

test('corrected seed route produces valid map markers', () => {
  const now = '2026-06-11T09:00:00.000Z';
  const nodes: ItineraryNode[] = reseplanrareSeedRows.map((row) => ({
    id: `node-${row.sourceRow}`,
    tripId: 'trip-1',
    createdBy: 'user-1',
    type: row.type,
    title: row.title ?? row.activity ?? row.hotel ?? row.place,
    startsAt: row.date,
    endsAt: null,
    timezone: null,
    location: row.location ?? null,
    sortOrder: row.sourceRow * 100,
    transportMode: 'driving',
    reservation: {},
    equipment: [],
    facilities: {},
    metadata: { source: 'reseplanrare.xlsx', sourceRow: row.sourceRow, place: row.place },
    notes: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
  }));

  const markers = extractValidMapMarkers(nodes);

  assert.equal(markers.length, 9);
  assert.deepEqual(markers.map((marker) => marker.label), ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
});
