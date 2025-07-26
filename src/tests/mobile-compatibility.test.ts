/**
 * Mobile Device Compatibility Tests
 *
 * This file contains tests to verify that our application works correctly
 * on mobile devices with different screen sizes and orientations.
 *
 * These tests use Playwright's device emulation capabilities to simulate
 * various mobile devices without requiring actual physical devices.
 */

// MIGRATION NOTICE
// This test file should be moved to tests/browser/mobile-compatibility.spec.ts
// The test.describe() issue will be resolved by placing the file in the correct directory
// as configured in the Playwright test configuration
//
// DO NOT RUN THIS TEST FILE DIRECTLY
// RUN THE TESTS USING: pnpm exec playwright test tests/browser/mobile-compatibility.spec.ts

import { test, expect, devices } from '@playwright/test'

// Define common test URLs
const TEST_URLS = {
  home: '/',
  blog: '/blog',
  documentation: '/docs',
  dashboard: '/admin/dashboard',
  simulator: '/simulator',
}

// Define breakpoints for testing responsive designs
const BREAKPOINTS = {
  xs: 320, // Small mobile
  sm: 375, // Standard mobile
  md: 768, // Tablet/larger mobile
  lg: 1024, // Small desktop/landscape tablet
}

// List of devices to test (using Playwright's predefined device presets)
const DEVICE_PRESETS = [
  devices['iPhone 13'],
  devices['iPhone 13 Pro Max'],
  devices['Pixel 5'],
  devices['Galaxy S8'],
  devices['iPad (gen 6)'],
  devices['iPad (gen 6) landscape'],
  devices['Galaxy Tab S4'],
]

// Skip mobile compatibility tests in CI environment
const skipTests = process.env.SKIP_BROWSER_COMPAT_TESTS === 'true'

// Use conditional test execution for describe blocks
;(skipTests ? describe.skip : describe)('Mobile Device Compatibility', () => {
  // Test each device preset on the homepage
  DEVICE_PRESETS.forEach((device) => {
    test(`Homepage should render properly on ${device.name}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        ...device,
      })
      const page = await context.newPage()

      await page.goto(TEST_URLS.home)

      // Verify key elements are visible
      await expect(page.locator('header')).toBeVisible()
      await expect(page.locator('footer')).toBeVisible()

      // Check for mobile navigation
      const isMobile = device.viewport.width < BREAKPOINTS.md
      if (isMobile) {
        // Mobile menu button should be visible on small screens
        await expect(
          page.locator('button[aria-label="Toggle menu"]'),
        ).toBeVisible()

        // Nav links should be hidden initially on mobile
        await expect(page.locator('nav ul')).not.toBeVisible()

        // Test mobile menu opens when clicked
        await page.locator('button[aria-label="Toggle menu"]').click()
        await expect(page.locator('nav ul')).toBeVisible()
      } else {
        // Nav links should be visible directly on larger screens
        await expect(page.locator('nav ul')).toBeVisible()
      }

      // Take a screenshot for visual verification
      await page.screenshot({
        path: `./test-results/mobile/${device.name.replace(/\s+/g, '-')}-home.png`,
      })
    })
  })

  // Test documentation page on mobile (critical for readability)
  test(`Documentation page should be usable on mobile devices`, async ({
    browser,
  }) => {
    // Use iPhone 13 as reference device
    const context = await browser.newContext({
      ...devices['iPhone 13'],
    })
    const page = await context.newPage()

    await page.goto(TEST_URLS.documentation)

    // Sidebar should be hidden by default on mobile
    await expect(page.locator('.docs-sidebar')).not.toBeVisible()

    // Sidebar toggle should be visible
    await expect(
      page.locator('button[aria-label="Toggle sidebar"]'),
    ).toBeVisible()

    // Table of contents should be present
    await expect(page.locator('.table-of-contents')).toBeVisible()

    // Test opening sidebar
    await page.locator('button[aria-label="Toggle sidebar"]').click()
    await expect(page.locator('.docs-sidebar')).toBeVisible()

    // Take screenshots
    await page.screenshot({
      path: `./test-results/mobile/iphone-13-docs-sidebar-open.png`,
    })

    // Close sidebar
    await page.locator('button[aria-label="Toggle sidebar"]').click()
    await expect(page.locator('.docs-sidebar')).not.toBeVisible()

    // Take screenshot of closed state
    await page.screenshot({
      path: `./test-results/mobile/iphone-13-docs-sidebar-closed.png`,
    })
  })

  // Test dashboard in both portrait and landscape
  test(`Dashboard should adapt to orientation changes`, async ({ browser }) => {
    // Test in portrait mode (iPhone 13)
    const portraitContext = await browser.newContext({
      ...devices['iPhone 13'],
    })
    const portraitPage = await portraitContext.newPage()

    await portraitPage.goto(TEST_URLS.dashboard)

    // Dashboard sidebar should be collapsed in portrait
    await expect(portraitPage.locator('.dashboard-sidebar')).not.toBeVisible()
    await expect(
      portraitPage.locator('button[aria-label="Toggle dashboard menu"]'),
    ).toBeVisible()

    // Take portrait screenshot
    await portraitPage.screenshot({
      path: `./test-results/mobile/iphone-13-dashboard-portrait.png`,
    })

    // Test in landscape mode
    const landscapeContext = await browser.newContext({
      ...devices['iPhone 13 landscape'],
    })
    const landscapePage = await landscapeContext.newPage()

    await landscapePage.goto(TEST_URLS.dashboard)

    // Take landscape screenshot
    await landscapePage.screenshot({
      path: `./test-results/mobile/iphone-13-dashboard-landscape.png`,
    })
  })

  // Test simulator on mobile
  test(`Simulator should be properly responsive on mobile`, async ({
    browser,
  }) => {
    // Test on a tablet (iPad) as it's more likely to be used on larger screens
    const tabletContext = await browser.newContext({
      ...devices['iPad (gen 6)'],
    })
    const page = await tabletContext.newPage()

    await page.goto(TEST_URLS.simulator)

    // Verify key elements are visible and properly sized
    await expect(
      page.locator('h2:has-text("Therapeutic Practice Simulator")'),
    ).toBeVisible()

    // In tablet view, we should see the scenario selector
    await expect(page.locator('text=Select a Practice Scenario')).toBeVisible()

    // Take tablet screenshot
    await page.screenshot({ path: `./test-results/mobile/ipad-simulator.png` })

    // Also test on a smaller phone screen
    const phoneContext = await browser.newContext({
      ...devices['iPhone 13'],
    })
    const phonePage = await phoneContext.newPage()

    await phonePage.goto(TEST_URLS.simulator)

    // Take phone screenshot
    await phonePage.screenshot({
      path: `./test-results/mobile/iphone-13-simulator.png`,
    })
  })
})
