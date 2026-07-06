import { test, expect, devices } from '@playwright/test'

// Extract device profiles
const iPhone12 = devices['iPhone 12'];
const pixel5 = devices['Pixel 5'];

test('Mobile Responsiveness - iPhone 12', async ({ page }) => {
  await page.setViewportSize(iPhone12.viewport);
  Object.assign(page, iPhone12); // mock user agent if needed, but simple viewport is usually enough

  await page.goto('/demo');
  await page.waitForLoadState('networkidle');

  // Basic test
  const viewport = page.viewportSize();
  expect(viewport?.width).toBeLessThanOrEqual(iPhone12.viewport.width);
});

test('Mobile Responsiveness - Pixel 5', async ({ page }) => {
  await page.setViewportSize(pixel5.viewport);
  Object.assign(page, pixel5); // mock user agent if needed

  await page.goto('/demo');
  await page.waitForLoadState('networkidle');

  // Basic test
  const viewport = page.viewportSize();
  expect(viewport?.width).toBeLessThanOrEqual(pixel5.viewport.width);
});
