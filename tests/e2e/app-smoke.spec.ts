import { expect, test } from '@playwright/test';

const persistedAppStateKey = 'roadtrip:persisted-app-state:v1';
const activeCloudTripIdKey = 'roadtrip:active-cloud-trip-id:v1';

type MockStopInput = {
  title: string;
  place: string;
  date?: string;
  time?: string;
  cost?: string;
  notes?: string;
  latitude?: string;
  longitude?: string;
};

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    if (window.name !== '__roadtrip_e2e_initialized') {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.name = '__roadtrip_e2e_initialized';
    }
  });
});

async function seedEditableDay(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.addInitScript((storageKey) => {
    const createdAt = '2026-06-01T00:00:00.000Z';
    const baseNode = {
      tripId: 'trip-e2e',
      createdBy: 'user-e2e',
      endsAt: null,
      timezone: 'Europe/Rome',
      transportMode: 'driving',
      reservation: {},
      equipment: [],
      facilities: {},
      metadata: {},
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      version: 1,
    };

    window.localStorage.setItem(storageKey, JSON.stringify({
      travelerCountText: '2',
      isEditMode: true,
      itineraryNodes: [
        {
          ...baseNode,
          id: 'node-e2e-1',
          type: 'custom',
          title: 'Malmö',
          startsAt: '2026-07-12T09:00:00.000+02:00',
          location: { latitude: 55.604981, longitude: 13.003822 },
          sortOrder: 10,
          metadata: { place: 'Malmö, Sweden' },
        },
        {
          ...baseNode,
          id: 'node-e2e-2',
          type: 'lodging',
          title: 'Eventhotel Ö-Cappuccino',
          startsAt: '2026-07-12T18:00:00.000+02:00',
          location: { latitude: 49.7685299, longitude: 10.4345108 },
          sortOrder: 20,
          metadata: { place: 'Rehweiler 1, 96160 Geiselwind-Rehweiler, Germany' },
        },
      ],
    }));
  }, persistedAppStateKey);
}

async function installQaBackend(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.addInitScript(() => {
    const now = '2026-06-29T10:00:00.000Z';
    const userId = 'user-qa-e2e';
    const tripId = 'trip-qa-e2e';
    const originalFetch = window.fetch.bind(window);
    const savedState = window.sessionStorage.getItem('__roadtripQaBackendState');
    const state = savedState ? JSON.parse(savedState) as {
      calls: { places: number; nearby: number; routes: number };
      trip: Record<string, unknown>;
      nodes: Array<Record<string, unknown>>;
      pois: Array<Record<string, unknown>>;
      exploreItems: Array<Record<string, unknown>>;
      inviteCode?: string;
    } : {
      calls: { places: 0, nearby: 0, routes: 0 },
      trip: {
        id: tripId,
        owner_id: userId,
        name: 'QA TEST Trip',
        description: 'QA mocked e2e trip',
        base_currency: 'SEK',
        starts_at: now,
        ends_at: null,
        home_location: null,
        settings: { avoidTolls: false, avoidHighways: false, preferScenicRoutes: true },
        version: 1,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      },
      nodes: [] as Array<Record<string, unknown>>,
      pois: [] as Array<Record<string, unknown>>,
      exploreItems: [] as Array<Record<string, unknown>>,
      inviteCode: 'QA123456',
    };

    Object.defineProperty(window, '__roadtripQaBackend', { configurable: true, value: state });

    function persistState() {
      window.sessionStorage.setItem('__roadtripQaBackendState', JSON.stringify(state));
    }

    function refreshStateFromStorage() {
      const currentState = window.sessionStorage.getItem('__roadtripQaBackendState');
      if (currentState) {
        Object.assign(state, JSON.parse(currentState));
      }
    }

    function json(data: unknown, status = 200) {
      return Promise.resolve(new Response(JSON.stringify(data), {
        status,
        headers: { 'content-type': 'application/json' },
      }));
    }

    function pointFromWkt(wkt: unknown) {
      if (typeof wkt !== 'string') {
        return { latitude: null, longitude: null };
      }

      const match = wkt.match(/POINT\((-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)\)/);
      return {
        longitude: match ? Number(match[1]) : null,
        latitude: match ? Number(match[2]) : null,
      };
    }

    function toNodeRow(body: Record<string, unknown>) {
      const point = pointFromWkt(body.location);
      return {
        id: body.id,
        trip_id: body.trip_id,
        poi_id: body.poi_id ?? null,
        created_by: body.created_by ?? userId,
        updated_by: body.updated_by ?? null,
        type: body.type ?? 'custom',
        title: body.title,
        notes: body.notes ?? null,
        starts_at: body.starts_at ?? null,
        ends_at: body.ends_at ?? null,
        timezone: body.timezone ?? null,
        location: point.latitude !== null && point.longitude !== null
          ? { type: 'Point', coordinates: [point.longitude, point.latitude] }
          : null,
        sort_order: body.sort_order ?? state.nodes.length + 1,
        transport_mode: body.transport_mode ?? 'driving',
        route_to_next: body.route_to_next ?? null,
        reservation: body.reservation ?? {},
        equipment: body.equipment ?? [],
        facilities: body.facilities ?? {},
        metadata: body.metadata ?? {},
        version: body.version ?? 1,
        created_at: now,
        updated_at: now,
        deleted_at: body.deleted_at ?? null,
      };
    }

    function upsertById(rows: Array<Record<string, unknown>>, row: Record<string, unknown>) {
      const index = rows.findIndex((candidate) => candidate.id === row.id);
      if (index >= 0) {
        rows[index] = { ...rows[index], ...row, updated_at: now };
      } else {
        rows.push(row);
      }

      persistState();
      return rows.find((candidate) => candidate.id === row.id) ?? row;
    }

    function routeSupabase(url: string, init?: RequestInit) {
      const parsed = new URL(url);
      const path = parsed.pathname;
      const method = (init?.method ?? 'GET').toUpperCase();
      const rawBody = typeof init?.body === 'string' ? init.body : '';
      const body = rawBody ? JSON.parse(rawBody) : {};

      if (path.includes('/auth/v1/signup') || path.includes('/auth/v1/token')) {
        return json({
          access_token: 'qa-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'qa-refresh',
          user: { id: userId, email: null, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: now },
        });
      }

      if (path.includes('/auth/v1/user')) {
        return json({ id: userId, email: null, app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: now });
      }

      if (path.includes('/rest/v1/user_profiles')) {
        return json({ id: userId, display_name: 'QA Tester', home_currency: 'SEK', created_at: now, updated_at: now });
      }

      if (path.includes('/rest/v1/trips')) {
        const requestedId = parsed.searchParams.get('id')?.replace('eq.', '');
        if (method === 'GET' && requestedId) {
          return json(requestedId === tripId ? state.trip : null, requestedId === tripId ? 200 : 404);
        }

        return method === 'GET' ? json([state.trip]) : json({ ...state.trip, ...body, updated_at: now });
      }

      if (path.includes('/rest/v1/trip_members')) {
        const ownerMember = { trip_id: tripId, user_id: userId, role: 'owner', joined_at: now };
        const editorMember = { trip_id: tripId, user_id: 'partner-qa-e2e', role: 'editor', joined_at: now };
        return method === 'GET' ? json([ownerMember, editorMember]) : json(ownerMember);
      }

      if (path.includes('/rest/v1/itinerary_nodes')) {
        if (method === 'GET') {
          return json(state.nodes.filter((node) => node.deleted_at === null));
        }

        if (method === 'PATCH') {
          const id = parsed.searchParams.get('id')?.replace('eq.', '');
          const node = state.nodes.find((candidate) => candidate.id === id);
          if (node) {
            node.deleted_at = body.deleted_at ?? now;
            node.updated_at = now;
            persistState();
          }
          return json([]);
        }

        return json(upsertById(state.nodes, toNodeRow(body)));
      }

      if (path.includes('/rest/v1/pois')) {
        const point = pointFromWkt(body.location);
        const row = {
          id: body.id,
          trip_id: body.trip_id ?? tripId,
          created_by: body.created_by ?? userId,
          name: body.name ?? 'QA TEST POI',
          category: body.category ?? 'poi',
          location: point.latitude !== null && point.longitude !== null
            ? { type: 'Point', coordinates: [point.longitude, point.latitude] }
            : { type: 'Point', coordinates: [13.003822, 55.604981] },
          address: body.address ?? null,
          source: body.source ?? 'google_places',
          external_ref: body.external_ref ?? null,
          rating: body.rating ?? null,
          opening_hours: body.opening_hours ?? {},
          contact: body.contact ?? {},
          imagery: body.imagery ?? [],
          metadata: body.metadata ?? {},
          is_private: body.is_private ?? true,
          version: body.version ?? 1,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        return json(upsertById(state.pois, row));
      }

      if (path.includes('/rest/v1/rpc/move_itinerary_node')) {
        const ordered = state.nodes.filter((node) => node.deleted_at === null).sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
        const index = ordered.findIndex((node) => node.id === body.input_node_id);
        const targetIndex = index + Number(body.input_direction);
        if (index >= 0 && targetIndex >= 0 && targetIndex < ordered.length) {
          const current = ordered[index]!;
          const target = ordered[targetIndex]!;
          const currentOrder = current.sort_order;
          current.sort_order = target.sort_order;
          target.sort_order = currentOrder;
          persistState();
        }
        return json(ordered);
      }

      if (path.includes('/rest/v1/rpc/create_trip_invite')) {
        state.inviteCode = 'QA123456';
        persistState();
        return json(state.inviteCode);
      }

      if (path.includes('/rest/v1/rpc/join_trip_by_code')) {
        if (String(body.input_code ?? '').toUpperCase() !== 'QA123456') {
          return json({ message: 'Invite code is invalid or expired.' }, 404);
        }
        return json(state.trip);
      }

      if (path.includes('/rest/v1/trip_explore_items')) {
        if (method === 'GET') {
          return json(state.exploreItems.filter((item) => item.deleted_at === null));
        }

        const row = {
          id: body.id ?? `explore-${state.exploreItems.length + 1}`,
          trip_id: body.trip_id ?? tripId,
          created_by: body.created_by ?? userId,
          item_type: body.item_type ?? 'place',
          title: body.title ?? 'QA TEST Explore',
          description: body.description ?? null,
          category: body.category ?? 'Mat',
          place_name: body.place_name ?? null,
          formatted_address: body.formatted_address ?? null,
          latitude: body.latitude ?? null,
          longitude: body.longitude ?? null,
          google_place_id: body.google_place_id ?? null,
          google_maps_url: body.google_maps_url ?? null,
          google_rating: body.google_rating ?? null,
          google_primary_type: body.google_primary_type ?? null,
          photo_name: body.photo_name ?? null,
          photo_reference: body.photo_reference ?? null,
          photo_url: body.photo_url ?? null,
          photo_attributions: body.photo_attributions ?? [],
          image_source: body.image_source ?? 'placeholder',
          sort_order: body.sort_order ?? state.exploreItems.length + 1,
          metadata: body.metadata ?? {},
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        return json(upsertById(state.exploreItems, row));
      }

      return null;
    }

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      refreshStateFromStorage();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      if (url.includes('supabase.co')) {
        const response = routeSupabase(url, init);
        if (response) {
          return response;
        }
      }

      if (url.includes('places.googleapis.com')) {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        const isNearby = url.includes(':searchNearby') || Boolean(body.locationBias);
        state.calls[isNearby ? 'nearby' : 'places'] += 1;
        persistState();
        const place = isNearby
          ? {
            id: 'qa-nearby-cafe',
            displayName: { text: 'QA TEST Cafe' },
            formattedAddress: 'QA TEST Cafe Address',
            location: { latitude: 55.607, longitude: 13.006 },
            rating: 4.4,
            primaryType: 'restaurant',
            googleMapsUri: 'https://maps.google.com/?q=qa-cafe',
          }
          : {
            id: 'qa-google-place',
            displayName: { text: body.textQuery?.includes('Munich') ? 'QA TEST München' : 'QA TEST Malmö' },
            formattedAddress: body.textQuery?.includes('Munich') ? 'Munich, Germany' : 'Malmö, Sweden',
            location: body.textQuery?.includes('Munich')
              ? { latitude: 48.1351, longitude: 11.582 }
              : { latitude: 55.604981, longitude: 13.003822 },
            rating: 4.6,
            primaryType: 'locality',
            googleMapsUri: 'https://maps.google.com/?q=qa-place',
          };
        return json({ places: [place] });
      }

      if (url.includes('routes.googleapis.com')) {
        state.calls.routes += 1;
        persistState();
        return json({
          routes: [{
            distanceMeters: 980000,
            duration: '39600s',
            polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
            legs: [{
              distanceMeters: 980000,
              duration: '39600s',
              polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
            }],
          }],
        });
      }

      return originalFetch(input, init);
    }) as typeof window.fetch;
  });
}

async function installMockGoogleMaps(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await page.addInitScript(() => {
    class MockMap {
      private element: HTMLElement;

      constructor(element: HTMLElement) {
        this.element = element;
      }

      addListener(eventName: string, handler: (event: { latLng: { lat: () => number; lng: () => number } }) => void) {
        const listener = () => handler({
          latLng: {
            lat: () => 55.61234,
            lng: () => 13.04567,
          },
        });
        if (eventName === 'click') {
          this.element.addEventListener('click', listener);
        }
        return {
          remove: () => this.element.removeEventListener('click', listener),
        };
      }

      setCenter() {}
      setZoom() {}
      fitBounds() {}
    }

    class MockMarker {
      setMap() {}
    }

    class MockPolyline {
      setMap() {}
    }

    class MockLatLngBounds {
      extend() {}
    }

    Object.defineProperty(window, 'google', {
      configurable: true,
      value: {
        maps: {
          Map: MockMap,
          Marker: MockMarker,
          Polyline: MockPolyline,
          LatLngBounds: MockLatLngBounds,
        },
      },
    });
  });
}

async function waitForQaConnection(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  await expect(page.getByText(/Ansluten: QA TEST Trip|Molnresan är tom än så länge|Resan sparas i Supabase/).first()).toBeVisible({ timeout: 15_000 });
}

async function fillStopEditor(page: Parameters<Parameters<typeof test>[1]>[0]['page'], stop: MockStopInput) {
  const editor = page.getByTestId('day-new-stop-editor').or(page.getByTestId('day-stop-edit-editor')).last();
  await expect(editor).toBeVisible();
  if (stop.date !== undefined) {
    await editor.getByPlaceholder('ÅÅÅÅ-MM-DD').fill(stop.date);
  }
  if (stop.time !== undefined) {
    await editor.getByPlaceholder('TT:MM').fill(stop.time);
  }
  await editor.getByPlaceholder('Titel *').fill(stop.title);
  await editor.getByPlaceholder('Plats eller adress').fill(stop.place);
  if (stop.cost !== undefined) {
    await editor.getByPlaceholder('Kostnad').fill(stop.cost);
  }
  if (stop.notes !== undefined) {
    await editor.getByPlaceholder('Anteckningar').fill(stop.notes);
  }
  if (stop.latitude !== undefined || stop.longitude !== undefined) {
    await editor.getByText('Visa detaljer').click();
    if (stop.latitude !== undefined) {
      await editor.getByPlaceholder('Latitud').fill(stop.latitude);
    }
    if (stop.longitude !== undefined) {
      await editor.getByPlaceholder('Longitud').fill(stop.longitude);
    }
  }
}

async function saveOpenEditor(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  const editor = page.getByTestId('day-new-stop-editor').or(page.getByTestId('day-stop-edit-editor')).last();
  await editor.getByText('Spara steg', { exact: true }).click();
}

async function ensureEditMode(page: Parameters<Parameters<typeof test>[1]>[0]['page']) {
  const editToggle = page.getByTestId('edit-mode-toggle');
  if (await editToggle.getByText('Redigera', { exact: true }).isVisible()) {
    await editToggle.click();
  }
}

test('main workspaces open and no obvious white screen appears', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();
  await expect(page.locator('body')).not.toHaveText('');

  await page.getByTestId('sidebar-nav-overview').click();
  await expect(page.getByText('Trip Readiness').or(page.getByText('Resestatus')).first()).toBeVisible();

  await page.getByTestId('sidebar-nav-explore').click();
  await expect(page.getByText('Anteckningar', { exact: true })).toBeVisible();
  await expect(page.getByText('Platser att besöka', { exact: true })).toBeVisible();
  await expect(page.getByText('Rekommenderade platser', { exact: true })).toBeVisible();

  await page.getByTestId('sidebar-nav-route').click();
  await expect(page.getByText('Kontrollera rutten')).toBeVisible();

  await page.getByTestId('sidebar-nav-days').click();
  await expect(page.getByTestId('selected-day-summary')).toBeVisible();

  await page.getByTestId('sidebar-nav-budget').click();
  await expect(page.getByText('Total kostnad').first()).toBeVisible();

  await page.getByTestId('sidebar-nav-tools').click();
  await expect(page.getByText('Tekniska verktyg').first()).toBeVisible();
});

test('day shortcut opens Dagar and planner surface is reachable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();

  await page.getByTestId('day-shortcut-2026-07-12').click();
  await expect(page.getByTestId('selected-day-summary')).toBeVisible();
  await expect(page.getByText('Dag 1 - Jul 12')).toBeVisible();
  await expect(page.getByPlaceholder('S\u00f6k stopp, plats, datum, pris...')).toBeVisible();
});

test('desktop uses one primary map surface and Rutt center stays list-first', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();

  await expect(page.getByTestId('desktop-map-rail')).toBeVisible();
  await expect(page.getByTestId('primary-map-surface')).toBeVisible();
  await expect(page.getByTestId('center-mobile-map')).toHaveCount(0);

  await page.getByTestId('sidebar-nav-route').click();
  await expect(page.getByTestId('route-center-summary')).toBeVisible();
  await expect(page.getByText('Stopp i ordning')).toBeVisible();
  await expect(page.getByTestId('center-mobile-map')).toHaveCount(0);
});

test('Dagar opens the add editor inside the selected day', async ({ page }) => {
  await seedEditableDay(page);
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();

  await page.getByTestId('sidebar-nav-days').click();
  await expect(page.getByTestId('selected-day-summary')).toBeVisible();
  await page.getByTestId('day-card-add-stop').click();

  const summaryBox = await page.getByTestId('selected-day-summary').boundingBox();
  const editorBox = await page.getByTestId('day-new-stop-editor').boundingBox();
  expect(summaryBox).not.toBeNull();
  expect(editorBox).not.toBeNull();
  expect(editorBox!.y).toBeGreaterThan(summaryBox!.y);
  expect(editorBox!.y - summaryBox!.y).toBeLessThan(520);
});

test('Dagar opens the edit editor directly inside the selected stop', async ({ page }) => {
  await seedEditableDay(page);
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();

  await page.getByTestId('sidebar-nav-days').click();
  const stopCard = page.getByTestId('day-stop-card').first();
  await stopCard.getByTestId('stop-open-full-editor').click();

  const stopBox = await stopCard.boundingBox();
  const editorBox = await page.getByTestId('day-stop-edit-editor').boundingBox();
  expect(stopBox).not.toBeNull();
  expect(editorBox).not.toBeNull();
  expect(editorBox!.y).toBeGreaterThan(stopBox!.y);
  expect(editorBox!.y).toBeLessThan(stopBox!.y + stopBox!.height);
});

test('mobile 375px has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Roadtrip Pro')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test('mobile route can still show an embedded map when the right rail is absent', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Roadtrip Pro')).toBeVisible();

  await page.getByTestId('top-nav-route').click();
  await expect(page.getByTestId('desktop-map-rail')).toHaveCount(0);
  await expect(page.getByTestId('center-mobile-map')).toBeVisible();
});

test('map click add prompts before opening the existing stop editor', async ({ page }) => {
  await installQaBackend(page);
  await installMockGoogleMaps(page);
  await page.addInitScript(() => {
    const backend = (window as unknown as { __roadtripQaBackend?: { nodes: Array<Record<string, unknown>> } }).__roadtripQaBackend;
    if (!backend) {
      return;
    }
    backend.nodes.push({
      id: 'map-click-existing-stop',
      trip_id: 'trip-qa-e2e',
      poi_id: null,
      created_by: 'user-qa-e2e',
      updated_by: null,
      type: 'custom',
      title: 'QA TEST Existing map day',
      notes: null,
      starts_at: '2026-07-12T09:00:00.000+02:00',
      ends_at: null,
      timezone: 'Europe/Stockholm',
      location: { type: 'Point', coordinates: [13.003822, 55.604981] },
      sort_order: 10,
      transport_mode: 'driving',
      route_to_next: null,
      reservation: {},
      equipment: [],
      facilities: {},
      metadata: { place: 'Malmo, Sweden' },
      version: 1,
      created_at: '2026-06-29T10:00:00.000Z',
      updated_at: '2026-06-29T10:00:00.000Z',
      deleted_at: null,
    });
    window.sessionStorage.setItem('__roadtripQaBackendState', JSON.stringify(backend));
  });

  await page.goto('/');
  await waitForQaConnection(page);
  await ensureEditMode(page);
  await page.getByTestId('day-shortcut-2026-07-12').click();

  const activeNodesBefore = await page.evaluate(() => (
    (window as unknown as { __roadtripQaBackend: { nodes: Array<{ deleted_at?: string | null }> } })
      .__roadtripQaBackend.nodes
      .filter((node) => node.deleted_at === null)
      .length
  ));

  await page.getByTestId('navigation-map-canvas').first().click();
  await expect(page.getByTestId('map-click-add-prompt').first()).toBeVisible();
  await expect(page.getByText('Lägg till plats här?').first()).toBeVisible();
  await page.getByTestId('map-click-cancel').first().click();
  await expect(page.getByTestId('map-click-add-prompt')).toHaveCount(0);
  await expect(page.getByTestId('day-new-stop-editor')).toHaveCount(0);

  const activeNodesAfterCancel = await page.evaluate(() => (
    (window as unknown as { __roadtripQaBackend: { nodes: Array<{ deleted_at?: string | null }> } })
      .__roadtripQaBackend.nodes
      .filter((node) => node.deleted_at === null)
      .length
  ));
  expect(activeNodesAfterCancel).toBe(activeNodesBefore);

  await page.getByTestId('navigation-map-canvas').first().click();
  await page.getByTestId('map-click-confirm').first().click();

  const editor = page.getByTestId('day-new-stop-editor');
  await expect(editor).toBeVisible();
  await expect(editor.getByPlaceholder('Titel *')).toHaveValue('Vald plats på kartan');
  await expect(editor.getByPlaceholder('Plats eller adress')).toHaveValue('Vald plats på kartan');
  await expect(editor.getByPlaceholder('Latitud')).toHaveValue('55.61234');
  await expect(editor.getByPlaceholder('Longitud')).toHaveValue('13.04567');

  const activeNodesAfterConfirm = await page.evaluate(() => (
    (window as unknown as { __roadtripQaBackend: { nodes: Array<{ deleted_at?: string | null }> } })
      .__roadtripQaBackend.nodes
      .filter((node) => node.deleted_at === null)
      .length
  ));
  expect(activeNodesAfterConfirm).toBe(activeNodesBefore);
});

test('Ny reseplan confirms local reset without claiming cloud deletion', async ({ page }) => {
  await installQaBackend(page);
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();
  await waitForQaConnection(page);

  let confirmation = '';
  page.once('dialog', async (dialog) => {
    confirmation = dialog.message();
    await dialog.accept();
  });

  await page.getByText('Ny reseplan').click();
  await expect(page.getByText('Börja planera din roadtrip')).toBeVisible();
  expect(confirmation).toContain('ny tom reseplan');
  expect(confirmation).toContain('påverkar inte tidigare sparade resor');
  expect(confirmation).not.toContain('raderar');
});

test('local persisted trip can sync into empty Supabase trip and reload from cloud', async ({ page }) => {
  await installQaBackend(page);
  await seedEditableDay(page);
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();

  await expect(page.getByTestId('local-cloud-import-card')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Lokal resa kan synkas till molnet')).toBeVisible();
  await page.getByTestId('copy-local-trip-to-supabase').click();
  await expect(page.getByText(/Resan sparas i Supabase|Synkade/).first()).toBeVisible();
  await expect(page.getByTestId('local-cloud-import-card')).toHaveCount(0);

  const backendTitles = await page.evaluate(() => (
    (window as unknown as { __roadtripQaBackend: { nodes: Array<{ title?: string; deleted_at?: string | null }> } })
      .__roadtripQaBackend.nodes
      .filter((node) => node.deleted_at === null)
      .map((node) => node.title)
  ));
  expect(backendTitles).toContain('Malmö');
  expect(backendTitles).toContain('Eventhotel Ö-Cappuccino');

  await page.reload();
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();
  await waitForQaConnection(page);
  await page.getByTestId('day-shortcut-2026-07-12').click();
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'Malmö' })).toBeVisible();
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'Eventhotel Ö-Cappuccino' })).toBeVisible();
});

test('sharing creates an invite link and invite URL loads the shared cloud trip', async ({ page }) => {
  await installQaBackend(page);
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();
  await waitForQaConnection(page);
  await ensureEditMode(page);

  await page.getByTestId('sidebar-nav-tools').click();
  await page.getByTestId('create-share-link').click();
  await expect(page.getByTestId('share-invite-link')).toContainText('invite=QA123456');
  await expect(page.getByText('Medlemmar')).toBeVisible();
  await expect(page.getByText('Kan redigera')).toBeVisible();

  await page.evaluate(() => {
    const backend = (window as unknown as { __roadtripQaBackend: { nodes: Array<Record<string, unknown>> } }).__roadtripQaBackend;
    backend.nodes.push({
      id: 'shared-node-1',
      trip_id: 'trip-qa-e2e',
      poi_id: null,
      created_by: 'user-qa-e2e',
      updated_by: null,
      type: 'custom',
      title: 'QA TEST Shared stop',
      notes: null,
      starts_at: '2026-07-14T09:00:00.000+02:00',
      ends_at: null,
      timezone: 'Europe/Stockholm',
      location: { type: 'Point', coordinates: [13.003822, 55.604981] },
      sort_order: 10,
      transport_mode: 'driving',
      route_to_next: null,
      reservation: {},
      equipment: [],
      facilities: {},
      metadata: { place: 'Malmo, Sweden' },
      version: 1,
      created_at: '2026-06-29T10:00:00.000Z',
      updated_at: '2026-06-29T10:00:00.000Z',
      deleted_at: null,
    });
    window.sessionStorage.setItem('__roadtripQaBackendState', JSON.stringify(backend));
  });

  await page.goto('/?invite=QA123456');
  await expect(page.getByText('Gick med i delad resa: QA TEST Trip').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('shared-trip-status')).toContainText('Delad resa aktiv');
  await expect(page.getByTestId('shared-trip-status')).toContainText('Trip ID: trip-qa-...');
  const activeCloudTripId = await page.evaluate((storageKey) => window.localStorage.getItem(storageKey), activeCloudTripIdKey);
  expect(activeCloudTripId).toBe('trip-qa-e2e');
  await page.getByTestId('day-shortcut-2026-07-14').click();
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Shared stop' })).toBeVisible();
  await expect(page.getByTestId('local-cloud-import-card')).toHaveCount(0);

  await page.reload();
  await waitForQaConnection(page);
  await page.getByTestId('day-shortcut-2026-07-14').click();
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Shared stop' })).toBeVisible();
});

test('connected planner can add, edit, persist, move menu, and delete QA stops', async ({ page }) => {
  await installQaBackend(page);
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();
  await waitForQaConnection(page);
  await ensureEditMode(page);

  await page.getByTestId('sidebar-nav-days').click();
  await page.getByTestId('empty-add-first-stop').click();
  await fillStopEditor(page, {
    title: 'QA TEST Malmö',
    place: 'Malmö, Sweden',
    date: '2026-07-12',
    time: '09:00',
    cost: '120',
    notes: 'QA TEST first stop',
    latitude: '55.604981',
    longitude: '13.003822',
  });
  await saveOpenEditor(page);
  await expect(page.getByText('Sparat').first()).toBeVisible();

  await page.getByTestId('day-card-add-stop').click();
  await fillStopEditor(page, {
    title: 'QA TEST München',
    place: 'Munich, Germany',
    date: '2026-07-12',
    time: '18:00',
    cost: '300',
    notes: 'QA TEST second stop',
    latitude: '48.1351',
    longitude: '11.582',
  });
  await saveOpenEditor(page);
  await expect(page.getByText('Sparat').first()).toBeVisible();

  const firstStop = page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Malmö' });
  await firstStop.getByTestId('stop-menu-button').click();
  await expect(firstStop.getByTestId('stop-menu-full-editor')).toBeVisible();
  await expect(firstStop.getByText('Flytta', { exact: true })).toBeVisible();
  await firstStop.getByTestId('stop-menu-full-editor').click();
  await fillStopEditor(page, {
    title: 'QA TEST Malmö edited',
    place: 'Malmö Centralstation',
    cost: '150',
    notes: 'QA TEST edited note',
  });
  await saveOpenEditor(page);
  await expect(page.getByText('Ändringar sparade').first()).toBeVisible();
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Malmö edited' })).toBeVisible();

  const backendTitles = await page.evaluate(() => (
    (window as unknown as { __roadtripQaBackend: { nodes: Array<{ title?: string; deleted_at?: string | null }> } })
      .__roadtripQaBackend.nodes
      .filter((node) => node.deleted_at === null)
      .map((node) => node.title)
  ));
  expect(backendTitles).toContain('QA TEST Malmö edited');
  expect(backendTitles).toContain('QA TEST München');

  await page.reload();
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();
  await waitForQaConnection(page);
  await page.getByTestId('day-shortcut-2026-07-12').click();
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Malmö edited' })).toBeVisible();
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST München' })).toBeVisible();
  await ensureEditMode(page);

  const editedStop = page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Malmö edited' });
  await editedStop.getByTestId('stop-menu-button').click();
  await editedStop.getByText('Flytta ner', { exact: true }).click();
  await expect(page.getByText('Flyttade steg: QA TEST Malmö edited').first()).toBeVisible();

  await editedStop.getByTestId('stop-menu-button').click();
  await editedStop.getByText('Ta bort', { exact: true }).click();
  await editedStop.getByText('Ja, ta bort', { exact: true }).click();
  await expect(page.getByText('Stopp borttaget.').first()).toBeVisible();
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Malmö edited' })).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();
  await waitForQaConnection(page);
  await page.getByTestId('day-shortcut-2026-07-12').click();
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Malmö edited' })).toHaveCount(0);
  await expect(page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST München' })).toBeVisible();
});

test('Google places, placeholder, route, fuel, and nearby flows are explicit and usable', async ({ page }) => {
  await installQaBackend(page);
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();
  await waitForQaConnection(page);
  await ensureEditMode(page);

  await page.getByTestId('sidebar-nav-days').click();
  await page.getByTestId('empty-add-first-stop').click();
  await fillStopEditor(page, {
    title: 'QA TEST Placeholder',
    place: 'Needs Google place',
    date: '2026-07-13',
    time: '09:00',
    cost: '100',
  });
  await saveOpenEditor(page);
  await expect(page.getByText('Sparat').first()).toBeVisible();

  await page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Placeholder' }).getByText('Fixa plats', { exact: true }).click();
  await page.getByPlaceholder('Sök kartposition').fill('QA TEST Malmö');
  await page.getByText('Sök', { exact: true }).click();
  await expect(page.getByText('QA TEST Malmö').first()).toBeVisible();
  await page.getByText('Välj', { exact: true }).click();
  await expect(page.getByText(/har kartposition|Position klar/).first()).toBeVisible();
  await expect(page.getByText('Platsnamnet kan ha ändrats')).toHaveCount(0);

  await page.getByTestId('day-card-add-stop').click();
  await fillStopEditor(page, {
    title: 'QA TEST München',
    place: 'Munich, Germany',
    date: '2026-07-13',
    time: '18:00',
    cost: '300',
    latitude: '48.1351',
    longitude: '11.582',
  });
  await saveOpenEditor(page);
  await expect(page.getByText('Sparat').first()).toBeVisible();

  const placeholderStop = page.getByTestId('day-stop-card').filter({ hasText: 'QA TEST Placeholder' });
  await placeholderStop.getByTestId('stop-menu-button').click();
  await placeholderStop.getByText('Lägg placeholder efter', { exact: true }).click();
  await expect(page.getByText('Planerat men inte bestämt').first()).toBeVisible();
  await expect(page.getByText('Hitta smart mellanstopp').first()).toBeVisible();

  await page.getByTestId('sidebar-nav-route').click();
  const routeCallsBefore = await page.evaluate(() => (window as unknown as { __roadtripQaBackend: { calls: { routes: number } } }).__roadtripQaBackend.calls.routes);
  expect(routeCallsBefore).toBe(0);
  await page.getByText('Beräkna rutt', { exact: true }).click();
  await expect(page.getByText(/Rutt beräknad med Google Routes/)).toBeVisible();
  await expect(page.getByText('Delsträckor', { exact: true })).toBeVisible();
  await expect(page.getByText(/placeholder saknar exakt plats/)).toBeVisible();
  const routeCallsAfter = await page.evaluate(() => (window as unknown as { __roadtripQaBackend: { calls: { routes: number } } }).__roadtripQaBackend.calls.routes);
  expect(routeCallsAfter).toBe(1);

  await page.getByPlaceholder('6.5').fill('7,2');
  await page.getByPlaceholder('20').fill('21');
  await expect(page.getByText('Bränslekostnad')).toBeVisible();
  await expect(page.getByText('Per person')).toBeVisible();
  await page.getByPlaceholder('6.5').fill('');
  await expect(page.getByText('Beräknad bensin')).toBeVisible();

  await page.getByTestId('sidebar-nav-explore').click();
  const nearbyCallsBefore = await page.evaluate(() => (window as unknown as { __roadtripQaBackend: { calls: { nearby: number } } }).__roadtripQaBackend.calls.nearby);
  expect(nearbyCallsBefore).toBe(0);
  await page.getByText('Sök nära').click();
  await expect(page.getByText('QA TEST Cafe', { exact: true })).toBeVisible();
  await page.getByText('Spara i Utforska', { exact: true }).click();
  await expect(page.getByText('QA TEST Cafe sparades i Utforska.').first()).toBeVisible();
  const nearbyCallsAfter = await page.evaluate(() => (window as unknown as { __roadtripQaBackend: { calls: { nearby: number } } }).__roadtripQaBackend.calls.nearby);
  expect(nearbyCallsAfter).toBe(1);
});
