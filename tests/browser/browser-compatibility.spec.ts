/**
 * Browser Compatibility Tests
 *
 * These tests verify our application works correctly across different browsers
 * using Playwright's browser automation capabilities.
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'

// Test URLs to check in different browsers
const TEST_URLS = [
  { url: '/', name: 'Home' },
  { url: '/blog', name: 'Blog' },
  { url: '/docs', name: 'Documentation' },
]

// Define a compatibility check test for each page
for (const { url, name } of TEST_URLS) {
  test(`${name} page should work in all browsers`, async ({
    page,
    browserName,
  }) => {
    // Set longer timeout for this test
    test.slow()

    // Log browser information
    console.log(`Testing ${name} page in ${browserName}`)

    // Navigate to the test page
    console.log(`Going to ${url}`)
    await page.goto(url)

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle')

    // Check that the page title is not empty
    const title = await page.title()
    console.log(`Page title: ${title}`)
    expect(title).not.toBe('')

    // Check for main content
    await expect(page.locator('main')).toBeVisible()

    // Create directory for screenshots in Node.js context
    try {
      fs.mkdirSync('./test-results/browser-compat', { recursive: true })
    } catch (_e) {
      // Directory might already exist
    }

    // Take a screenshot
    await page.screenshot({
      path: `./test-results/browser-compat/${browserName}-${name.toLowerCase()}.png`,
    })

    // Check for console errors
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Scroll through the page to trigger any lazy-loaded content
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight * 0.3)
    })
    await page.waitForTimeout(300)

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight * 0.6)
    })
    await page.waitForTimeout(300)

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await page.waitForTimeout(300)

    // Verify there are no console errors (except for known ones)
    expect(errors.filter((e) => !e.includes('process is not defined'))).toEqual(
      [],
    )
  })
}

// Test for CSS feature support across browsers
test('CSS feature support check', async ({ page, browserName }) => {
  // Navigate to home page
  await page.goto('/')

  // Check for browser support of modern CSS features
  const cssFeatures = await page.evaluate(() => {
    return {
      flexbox:
        window.CSS &&
        window.CSS.supports &&
        window.CSS.supports('display', 'flex'),
      grid:
        window.CSS &&
        window.CSS.supports &&
        window.CSS.supports('display', 'grid'),
      variables:
        window.CSS && window.CSS.supports && window.CSS.supports('(--a: 0)'),
      sticky:
        window.CSS &&
        window.CSS.supports &&
        (window.CSS.supports('position', 'sticky') ||
          window.CSS.supports('position', '-webkit-sticky')),
      animations: 'animation' in document.documentElement.style,
      filters:
        window.CSS &&
        window.CSS.supports &&
        (window.CSS.supports('filter', 'blur(5px)') ||
          window.CSS.supports('-webkit-filter', 'blur(5px)')),
      aspectRatio:
        window.CSS &&
        window.CSS.supports &&
        window.CSS.supports('aspect-ratio', '16/9'),
    }
  })

  console.log(`CSS features support in ${browserName}:`, cssFeatures)

  // Log any missing features but don't fail the test
  Object.entries(cssFeatures).forEach(([feature, supported]) => {
    if (!supported) {
      console.warn(`${browserName} doesn't support CSS ${feature}`)
    }
  })

  // Take screenshot of the page
  await page.screenshot({
    path: `./test-results/browser-compat/${browserName}-css-features.png`,
  })
})
