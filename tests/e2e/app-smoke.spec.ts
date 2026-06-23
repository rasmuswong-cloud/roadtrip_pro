import { expect, test } from '@playwright/test';

const persistedAppStateKey = 'roadtrip:persisted-app-state:v1';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
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
  await expect(page.getByText('Vad h\u00e4nder varje dag?')).toBeVisible();

  await page.getByTestId('sidebar-nav-budget').click();
  await expect(page.getByText('Total kostnad').first()).toBeVisible();

  await page.getByTestId('sidebar-nav-tools').click();
  await expect(page.getByText('Tekniska verktyg').first()).toBeVisible();
});

test('day shortcut opens Dagar and planner surface is reachable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();

  await page.getByTestId('day-shortcut-2026-07-12').click();
  await expect(page.getByText('Vad h\u00e4nder varje dag?')).toBeVisible();
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
