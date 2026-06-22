import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
});

test('main workspaces open and no obvious white screen appears', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Alp-roadtrip')).toBeVisible();
  await expect(page.locator('body')).not.toHaveText('');

  await page.getByTestId('sidebar-nav-overview').click();
  await expect(page.getByText('Trip Readiness').or(page.getByText('Resestatus')).first()).toBeVisible();

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

test('mobile 375px has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/');
  await expect(page.getByText('Roadtrip Pro')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
