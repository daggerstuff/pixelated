import { test, expect } from '@playwright/test'

// Test for login page structure
test('login page has correct form elements', async ({ page }) => {
  await page.goto('/login')

  // Check for form elements
  await expect(page.locator('form')).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()

  // Check for "Remember me" checkbox
  await expect(page.locator('input[type="checkbox"]')).toBeVisible()
  await expect(
    page.locator('label').filter({ hasText: /remember me/i }),
  ).toBeVisible()
})

// Test for login form validation
test('login form shows validation errors', async ({ page }) => {
  await page.goto('/login')

  // Try to submit the form without filling it
  await page.click('button[type="submit"]')

  // Check that validation errors are shown
  await expect(
    page.locator('text=Email is required, Password is required'),
  ).toBeVisible()

  // Fill email but not password
  await page.fill('input[type="email"]', 'test@example.com')
  await page.click('button[type="submit"]')

  // Check that only password error is shown
  await expect(page.locator('text=Password is required')).toBeVisible()
  await expect(page.locator('text=Email is required')).not.toBeVisible()
})

// Test for mobile viewport issues on auth pages
test('login form is properly visible on mobile viewport', async ({
  page,
  isMobile,
}) => {
  // Skip this test for non-mobile browsers
  test.skip(!isMobile, 'This test is mobile-only')

  await page.goto('/login')

  // Check that all form elements are visible without scrolling
  await expect(page.locator('form')).toBeVisible()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()

  // Test input field focus behavior
  await page.fill('input[type="email"]', 'test@example.com')

  // Check that the input field remains visible when focused
  // This is important to verify that the virtual keyboard doesn't push content off screen
  await expect(page.locator('input[type="email"]')).toBeInViewport()
})

// Test for page transitions
test('login page has proper transitions', async ({ page }) => {
  await page.goto('/login')

  // Wait for any initial page transitions to complete
  await page.waitForTimeout(500)

  // Navigate to password reset
  const passwordResetLink = page
    .locator('a')
    .filter({ hasText: /forgot.*password/i })
  await expect(passwordResetLink).toBeVisible()

  // Start waiting for navigation before clicking
  const navigationPromise = page.waitForNavigation({ waitUntil: 'networkidle' })
  await passwordResetLink.click()
  await navigationPromise

  // Verify we're on the password reset page
  await expect(page).toHaveURL(/reset-password/)
})

// Visual regression test for login page
test('login page visual comparison', async ({ page }) => {
  await page.goto('/login')

  // Wait for any animations to complete
  await page.waitForTimeout(1000)

  // Take screenshot for visual comparison
  await expect(page).toHaveScreenshot('login-page.png', {
    maxDiffPixelRatio: 0.02,
  })
})
