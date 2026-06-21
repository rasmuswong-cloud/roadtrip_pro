import test from 'node:test';
import assert from 'node:assert/strict';
import {
  googlePlacesMissingApiKeyMessage,
  hasGooglePlacesApiKey,
  searchGooglePlaces,
} from '../src/services/google/googlePlaces';

const originalFetch = globalThis.fetch;
const originalPlacesKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
const originalMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

function restoreEnvironment() {
  globalThis.fetch = originalFetch;
  if (originalPlacesKey === undefined) {
    delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  } else {
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = originalPlacesKey;
  }
  if (originalMapsKey === undefined) {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  } else {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = originalMapsKey;
  }
}

test('Google Places search can reuse the Google Maps public key fallback', async () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'maps-key-for-test';

  let usedKey = '';
  globalThis.fetch = (async (_url, init) => {
    const headers = init?.headers as Record<string, string>;
    usedKey = headers['X-Goog-Api-Key'];
    return new Response(JSON.stringify({
      places: [{
        id: 'places/malmo',
        displayName: { text: 'Malmo' },
        formattedAddress: 'Malmo, Sweden',
        location: { latitude: 55.605, longitude: 13.0038 },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;

  try {
    const results = await searchGooglePlaces({ query: 'Malmo', maxResultCount: 1 });

    assert.equal(hasGooglePlacesApiKey(), true);
    assert.equal(usedKey, 'maps-key-for-test');
    assert.equal(results[0]?.location?.latitude, 55.605);
  } finally {
    restoreEnvironment();
  }
});

test('Google Places search reports a clear missing key message', async () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
  delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  try {
    assert.equal(hasGooglePlacesApiKey(), false);
    await assert.rejects(
      searchGooglePlaces({ query: 'Malmo' }),
      new RegExp(googlePlacesMissingApiKeyMessage().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  } finally {
    restoreEnvironment();
  }
});
