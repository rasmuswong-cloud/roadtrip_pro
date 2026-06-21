import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePostgisPoint, toPostgisPoint } from '../src/services/database/geo';

test('PostGIS point mapper writes WKT with numeric longitude and latitude', () => {
  assert.equal(
    toPostgisPoint({ latitude: 55.604981, longitude: 13.003822 }),
    'SRID=4326;POINT(13.003822 55.604981)',
  );
});

test('PostGIS point parser reads WKT and GeoJSON coordinate shapes', () => {
  assert.deepEqual(parsePostgisPoint('SRID=4326;POINT(13.003822 55.604981)'), {
    longitude: 13.003822,
    latitude: 55.604981,
  });
  assert.deepEqual(parsePostgisPoint({ type: 'Point', coordinates: [13.003822, 55.604981] }), {
    longitude: 13.003822,
    latitude: 55.604981,
  });
});

test('PostGIS point parser reads EWKB hex returned by PostGIS geography columns', () => {
  assert.deepEqual(parsePostgisPoint('0101000020E6100000A835CD3B4ED42A40A56B26DF6FCD4B40'), {
    longitude: 13.414659375,
    latitude: 55.60497655273438,
  });
});
