import test from 'node:test';
import assert from 'node:assert/strict';
import { reseplanrareSeedRows } from '../src/data/reseplanrareSeed';

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
