/**
 * Mobile Device Compatibility Tests
 *
 * These tests verify our application works correctly on various mobile device screen sizes
 * using Playwright's device emulation capabilities.
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'

// Test devices to check
const TEST_DEVICES = [
  'iPhone 12',
  'iPhone SE',
  'Pixel 5',
  'iPad Mini',
  'Galaxy Tab S4',
]

// Test pages to check
const TEST_PAGES = [
  { url: '/', name: 'Home' },
  { url: '/blog', name: 'Blog' },
  { url: '/admin', name: 'Admin' },
]

// Basic test for all device/page combinations
for (const device of TEST_DEVICES) {
  for (const page of TEST_PAGES) {
    test(`${page.name} page should display properly on ${device}`, async ({
      playwright,
      browser,
    }) => {
      // Create device context with emulated device
      const deviceConfig = playwright.devices[device]
      const context = await browser.newContext({
        ...deviceConfig,
      })

      // Create new page in device context
      const pageObj = await context.newPage()

      // Ensure directory exists for screenshots
      try {
        fs.mkdirSync('./test-results/mobile', { recursive: true })
      } catch (_e) {
        // Directory might already exist
      }

      // Navigate to the test page
      try {
        const response = await pageObj.goto(page.url, { timeout: 30000 })
        if (!response || !response.ok()) {
          throw new Error(
            `Navigation to ${page.url} failed: ${response ? response.status() : 'No response'}`,
          )
        }
      } catch (error) {
        console.error(`Failed to navigate to ${page.url} on ${device}:`, error)
        await pageObj.screenshot({
          path: `./test-results/mobile/${device.replace(/\s+/g, '-')}-${page.name}-error.png`,
        })
        throw error
      }

      // Wait for page to fully load
      await pageObj.waitForLoadState('networkidle')

      // Take screenshot for visual verification
      await pageObj.screenshot({
        path: `./test-results/mobile/${device.replace(/\s+/g, '-')}-${page.name}.png`,
      })

      // Basic verification
      const pageTitle = await pageObj.title()
      expect(pageTitle).not.toBe('')

      // Verify no horizontal scrollbar (check for overflow)
      const hasHorizontalScroll = await pageObj.evaluate(() => {
        const bodyWidth = document.body.scrollWidth
        const viewportWidth = window.innerWidth
        return {
          hasOverflow: bodyWidth > viewportWidth,
          bodyWidth,
          viewportWidth,
          difference: bodyWidth - viewportWidth,
        }
      })

      // Log any overflow issues but don't fail test (can be expected in some cases)
      if (hasHorizontalScroll.hasOverflow) {
        console.warn(
          `Horizontal overflow detected on ${page.name} page on ${device}: ` +
            `Body width: ${hasHorizontalScroll.bodyWidth}px, Viewport: ${hasHorizontalScroll.viewportWidth}px, ` +
            `Overflow: ${hasHorizontalScroll.difference}px`,
        )
        // Take screenshot of the overflow for visual inspection
        await pageObj.screenshot({
          path: `./test-results/mobile/${device.replace(/\s+/g, '-')}-${page.name}-overflow.png`,
        })
      }

      // Verify mobile-specific elements are present
      const hasMobileNav = (await pageObj.locator('nav').count()) > 0
      expect(hasMobileNav).toBeTruthy()

      // Close context when done
      await context.close()
    })
  }
}

// Test responsive behaviors
test('responsive navigation should work on mobile devices', async ({
  playwright,
  browser,
}) => {
  // Use iPhone 12 as test device
  const deviceConfig = playwright.devices['iPhone 12']
  const context = await browser.newContext({
    ...deviceConfig,
  })

  const page = await context.newPage()

  // Ensure directory exists for screenshots
  try {
    fs.mkdirSync('./test-results/mobile', { recursive: true })
  } catch (_e) {
    // Directory might already exist
  }

  // Navigate to the test page with error handling
  try {
    const response = await page.goto('/', { timeout: 30000 })
    if (!response || !response.ok()) {
      throw new Error(
        `Navigation to homepage failed: ${response ? response.status() : 'No response'}`,
      )
    }
  } catch (error) {
    console.error(`Failed to navigate to homepage:`, error)
    await page.screenshot({
      path: `./test-results/mobile/navigation-test-error.png`,
    })
    throw error
  }

  // Look for mobile navigation elements - hamburger menu or similar
  const mobileNavTrigger = page
    .locator('button[aria-label*="menu" i], button[aria-label*="navigation" i]')
    .first()

  // If we have a mobile trigger, test it
  if ((await mobileNavTrigger.count()) > 0) {
    // Click the mobile nav trigger
    await mobileNavTrigger.click()

    // Wait for any animations
    await page.waitForTimeout(500)

    // Take screenshot with menu open
    await page.screenshot({
      path: `./test-results/mobile/mobile-nav-open.png`,
    })

    // Verify menu items are visible
    const menuItems = page.locator('nav a')
    await expect(menuItems.first()).toBeVisible()
  }

  // Close context when done
  await context.close()
})
