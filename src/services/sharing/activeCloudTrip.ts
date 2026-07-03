export const ACTIVE_CLOUD_TRIP_ID_KEY = 'roadtrip:active-cloud-trip-id:v1';

export function readPersistedActiveCloudTripId(storage = getLocalStorage()): string | null {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(ACTIVE_CLOUD_TRIP_ID_KEY);
    return isSafeTripId(value) ? value : null;
  } catch {
    return null;
  }
}

export function persistActiveCloudTripId(tripId: string, storage = getLocalStorage()): void {
  if (!storage || !isSafeTripId(tripId)) {
    return;
  }

  try {
    storage.setItem(ACTIVE_CLOUD_TRIP_ID_KEY, tripId);
  } catch {
    // Remembering the active cloud trip is helpful, but Supabase remains authoritative.
  }
}

export function clearPersistedActiveCloudTripId(storage = getLocalStorage()): void {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(ACTIVE_CLOUD_TRIP_ID_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function shortenTripId(tripId: string | null | undefined): string {
  if (!tripId) {
    return '';
  }

  return tripId.length <= 8 ? tripId : `${tripId.slice(0, 8)}...`;
}

export function tripRoleLabel(role: string | null | undefined): string {
  if (role === 'owner') {
    return 'ägare';
  }

  if (role === 'editor') {
    return 'redigerare';
  }

  if (role === 'viewer') {
    return 'läsare';
  }

  return 'okänd';
}

function isSafeTripId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && /^[a-zA-Z0-9_-]{6,80}$/.test(value);
}

function getLocalStorage(): Storage | null {
  try {
    if (!('localStorage' in globalThis)) {
      return null;
    }

    return globalThis.localStorage;
  } catch {
    return null;
  }
}
