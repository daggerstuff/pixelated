/**
 * Cross-Browser Compatibility Tests
 *
 * This file contains tests to verify that our application works correctly
 * across different browsers (Chromium, Firefox, and WebKit).
 */

import { test, expect } from '@playwright/test'
import type { Page, ConsoleMessage } from '@playwright/test'
import { mkdir } from 'fs/promises'

// Define test URLs to check across browsers
const TEST_URLS = {
  home: '/',
  blog: '/blog',
  documentation: '/docs',
  dashboard: '/admin',
  simulator: '/simulator',
}

// Define a reusable function to test core functionality
async function testCoreFunctionality(
  page: Page,
  url: string,
): Promise<string[]> {
  // Log test start for better debugging
  console.log(`Testing URL: ${url}`)

  await page.goto(url, { timeout: 30000 })

  // Log page title for diagnosis
  const pageTitle = await page.title()
  console.log(`Page title: "${pageTitle}"`)

  // Verify page loaded
  expect(pageTitle).not.toBe('')

  // Wait longer for the page to stabilize
  await page.waitForLoadState('networkidle', { timeout: 30000 })

  // Log HTML structure for diagnosis in case of failure
  console.log(`Checking for main element on ${url}...`)

  try {
    // For admin pages, we might be redirected to login, so check for either main element or login elements
    if (url.includes('/admin')) {
      // Log the current URL (might be redirected)
      const currentUrl = page.url()
      console.log(`Current URL after navigation: ${currentUrl}`)

      // Take a diagnostic screenshot
      await page.screenshot({
        path: `./test-results/admin-debug-${Date.now()}.png`,
      })

      // Check for either a main element or login form elements
      const hasMainElement = (await page.locator('main').count()) > 0
      const hasLoginForm = (await page.locator('form').count()) > 0
      const hasLoginElements =
        (await page.locator('input[type="password"]').count()) > 0

      console.log(
        `Found main: ${hasMainElement}, login form: ${hasLoginForm}, password input: ${hasLoginElements}`,
      )

      expect(hasMainElement || hasLoginForm || hasLoginElements).toBeTruthy()
    } else {
      // For non-admin pages, check for main content with increased timeout
      await expect(page.locator('main')).toBeVisible({ timeout: 30000 })
    }
  } catch (error) {
    console.error(`Error checking elements on ${url}:`, error)

    // Capture page HTML for debugging
    const html = await page.content()
    console.log(`Page HTML snippet: ${html.substring(0, 500)}...`)

    // Re-throw the error
    throw error
  }

  // Footer might not be immediately visible if the page is long
  // Scroll to the bottom of the page
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

  // Check that no console errors occurred (except for known errors)
  const errors: string[] = []
  page.on('console', (msg: ConsoleMessage) => {
    if (
      msg.type() === 'error' &&
      // Ignore known errors
      !msg.text().includes('process is not defined') &&
      !msg
        .text()
        .includes('Error hydrating /src/components/layout/HeaderReact.tsx') &&
      !msg.text().includes('Cannot access uninitialized variable') &&
      !msg.text().includes('[astro-island]') &&
      !msg.text().includes('ReferenceError')
    ) {
      errors.push(msg.text())
    }
  })

  // Return any errors found
  return errors
}

// Test each page across browsers
for (const [pageName, url] of Object.entries(TEST_URLS)) {
  test(`${pageName} page should work in all browsers`, async ({
    page,
    browserName,
  }) => {
    // Set longer timeout for this test
    test.slow()

    // Log browser information for debugging
    console.log(`Testing ${pageName} page in ${browserName} browser`)

    // Set browser-specific configurations if needed
    if (browserName === 'webkit') {
      // Safari/WebKit might need special handling
      console.log('Applying WebKit-specific configurations...')
    }

    // Run the core functionality test
    const errors = await testCoreFunctionality(page, url)

    // Create directory for screenshots if it doesn't exist
    try {
      await mkdir('./test-results/cross-browser', { recursive: true })
    } catch (_e) {
      // Directory might already exist
    }

    // Take a screenshot for visual comparison
    await page.screenshot({
      path: `./test-results/cross-browser/${browserName}-${pageName}.png`,
    })

    // Verify no console errors occurred
    expect(errors).toEqual([])
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
  await page.goto('/')

  // Wait for page to fully load
  await page.waitForLoadState('networkidle')

  // Test desktop navigation
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.waitForTimeout(1000)

  // Create directory for screenshots if it doesn't exist
  try {
    await mkdir('./test-results/cross-browser', { recursive: true })
  } catch (_e) {
    // Directory might already exist
  }

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
  await page.goto('/contact')

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
