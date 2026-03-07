import { test, expect } from '@playwright/test'

test('homepage has correct layout on desktop', async ({ page }) => {
  await page.goto('/')

  // Check navigation is visible
  await expect(page.locator('nav')).toBeVisible()

  // Check main sections of the page
  await expect(page.locator('main')).toBeVisible()

  // Make sure footer exists
  await expect(page.locator('footer')).toBeVisible()
})

// Mobile-specific test
test('homepage navigation is correctly transformed on mobile', async ({
  page,
  isMobile,
}) => {
  // Skip this test for non-mobile browsers
  test.skip(!isMobile, 'This test is mobile-only')

  await page.goto('/')

  // Check that mobile menu button is visible
  await expect(
    page.locator('.mobile-menu-button, .hamburger, [aria-label="Menu"]'),
  ).toBeVisible()

  // Desktop navigation should be hidden on mobile
  await expect(page.locator('nav.desktop-nav, nav > ul')).not.toBeVisible()

  // Click on the mobile menu button
  await page
    .locator('.mobile-menu-button, .hamburger, [aria-label="Menu"]')
    .click()

  // After clicking, the mobile menu should be visible
  await expect(
    page.locator('.mobile-menu-content, nav.mobile-menu'),
  ).toBeVisible()
})

// Test for visual regression
test('homepage visual comparison', async ({ page }) => {
  await page.goto('/')

  // Wait for any animations to complete
  await page.waitForTimeout(1000)

  // Take screenshot for visual comparison
  await expect(page).toHaveScreenshot('homepage.png', {
    // Allow small differences due to rendering variations across browsers
    maxDiffPixelRatio: 0.02,
  })
})
