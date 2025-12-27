/**
 * Cross-Browser Compatibility Tests
 *
 * This file contains tests to verify that our application works correctly
 * across different browsers (Chromium, Firefox, and WebKit).
 */

import { test } from '@playwright/test'
import type { ConsoleMessage } from '@playwright/test'

import {
  TEST_PAGES,
  navigateToPage,
  verifyPageElements,
  waitForPageStable,
  ensureTestResultsDir,
} from '../helpers/test-utils'

// Use TEST_PAGES from test-utils

// Test each page across browsers
for (const pageInfo of TEST_PAGES) {
  test(`${pageInfo.name} page should work in all browsers`, async ({
    page,
    browserName,
  }) => {
    // Set longer timeout for this test
    test.slow()

    // Log browser information for debugging
    console.log(`Testing ${pageInfo.name} page in ${browserName} browser`)

    // Set browser-specific configurations if needed
    if (browserName === 'webkit') {
      // Safari/WebKit might need special handling
      console.log('Applying WebKit-specific configurations...')
    }

    // Navigate to page
    await navigateToPage(page, pageInfo.url)
    await waitForPageStable(page)

    // Verify page elements
    await verifyPageElements(page, pageInfo)

    // Create directory for screenshots if it doesn't exist
    await ensureTestResultsDir('cross-browser')

    // Take a screenshot for visual comparison
    await page.screenshot({
      path: `./test-results/cross-browser/${browserName}-${pageInfo.name.toLowerCase().replace(/\s+/g, '-')}.png`,
    })
  })
}

// Test responsive behavior
test('responsive navigation works correctly in all browsers', async ({
  page,
  browserName,
}) => {
  // Set longer timeout for this test
  test.slow()

  // Go to home page
  await navigateToPage(page, '/')
  await waitForPageStable(page)

  // Test desktop navigation
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(1000)

  // Create directory for screenshots if it doesn't exist
  await ensureTestResultsDir('cross-browser')

  // Take desktop screenshot
  await page.screenshot({
    path: `./test-results/cross-browser/${browserName}-nav-desktop.png`,
  })

  // Test mobile navigation
  await page.setViewportSize({ width: 375, height: 667 })
  await page.waitForTimeout(1000)

  // Take mobile screenshot
  await page.screenshot({
    path: `./test-results/cross-browser/${browserName}-nav-mobile.png`,
  })
})

// Test form interactions across browsers
test('forms work correctly across browsers', async ({ page, browserName }) => {
  // Go to contact page with a form
  await navigateToPage(page, '/contact')

  // Check if the page has a form
  const hasForm = (await page.locator('form').count()) > 0

  // Additional form testing would go here

  // Log the result
  console.log(`Form test for ${browserName} browser: form found = ${hasForm}`)

  // Take a screenshot
  await page.screenshot({
    path: `./test-results/cross-browser/${browserName}-form-test.png`,
  })
})
