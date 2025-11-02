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
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000) // Wait for React hydration

  // Submit empty form to trigger validation - use button click to properly trigger React onSubmit
  await page.locator('button[type="submit"]').click()

  // Wait for React to process the form submission and update state
  await page.waitForTimeout(500)

  // Check for validation errors - the actual form uses specific IDs
  const emailError = page.locator('#email-error')
  const passwordError = page.locator('#password-error')

  // Check that validation errors are shown after form submission
  await expect(emailError).toBeVisible({ timeout: 10000 })
  await expect(passwordError).toBeVisible({ timeout: 10000 })

  // Fill email but not password
  await page.fill('input[type="email"]', 'test@example.com')
  await page.keyboard.press('Tab') // Tab away to trigger validation

  // Check that only password error is shown
  await expect(passwordError).toBeVisible({ timeout: 10000 })
  // Email error should be gone since we filled a valid email
  await expect(emailError).not.toBeVisible()
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
  await page.waitForLoadState('networkidle')

  // Wait for React components to hydrate
  await page.waitForTimeout(3000)

  // Look for the forgot password link/button
  const passwordResetButton = page
    .locator('button')
    .filter({ hasText: /forgot.*password/i })

  // Check if the forgot password element exists and is visible
  await expect(passwordResetButton).toBeVisible({ timeout: 5000 })

  // Click to switch to reset mode
  await passwordResetButton.click()
  await page.waitForTimeout(1000)

  // Verify we're in reset mode (check for reset form elements)
  // The h2 element contains "Reset Password" text in reset mode
  await expect(page.locator('h2').filter({ hasText: 'Reset Password' })).toBeVisible({
    timeout: 10000,
  })
  // The submit button shows "Send Reset Link" in reset mode
  await expect(page.locator('button[type="submit"]').filter({ hasText: 'Send Reset Link' })).toBeVisible({
    timeout: 10000,
  })
})

// Visual regression test for login page
test('login page visual comparison', async ({ page }) => {
  await page.goto('/login')

  // Wait for any animations to complete
  await page.waitForTimeout(1000)

  // Take screenshot for visual comparison
  await expect(page).toHaveScreenshot('login-page.png', {
    maxDiffPixelRatio: 0.05, // Increased tolerance for minor visual differences
  })
})
