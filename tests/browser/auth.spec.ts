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

  // Wait for form to be ready
  await expect(page.locator('form')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()

  // Submit empty form to trigger validation
  await page.click('button[type="submit"]')

  // Wait for React to process the form submission and update state
  // The form should validate and show errors immediately
  const emailError = page.locator('#email-error')
  const passwordError = page.locator('#password-error')

  // Wait for error elements to lose the 'hidden' class and become visible
  // First check that the hidden class is removed (React state update)
  await page.waitForFunction(
    () => {
      const emailEl = document.getElementById('email-error')
      const passwordEl = document.getElementById('password-error')
      return (
        emailEl &&
        passwordEl &&
        !emailEl.classList.contains('hidden') &&
        !passwordEl.classList.contains('hidden') &&
        emailEl.textContent?.trim() !== '' &&
        passwordEl.textContent?.trim() !== ''
      )
    },
    { timeout: 10000 }
  )

  // Now verify they're visible and contain error text
  await expect(emailError).toBeVisible({ timeout: 5000 })
  await expect(passwordError).toBeVisible({ timeout: 5000 })
  await expect(emailError).toContainText(/required/i, { timeout: 5000 })
  await expect(passwordError).toContainText(/required/i, { timeout: 5000 })

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

  // Wait for form to be ready
  await expect(page.locator('form')).toBeVisible()

  // Look for the forgot password link/button
  const passwordResetButton = page
    .locator('button')
    .filter({ hasText: /forgot.*password/i })

  // Check if the forgot password element exists and is visible
  await expect(passwordResetButton).toBeVisible({ timeout: 5000 })

  // Click to switch to reset mode
  await passwordResetButton.click()

  // Wait for React state update and DOM re-render
  await page.waitForTimeout(500)

  // Wait for the h2 to appear - use a more flexible selector
  const resetPasswordHeading = page.locator('h2').filter({ hasText: /reset.*password/i })
  await expect(resetPasswordHeading).toBeVisible({
    timeout: 10000,
  })

  // The submit button shows "Send Reset Link" in reset mode
  const submitButton = page.locator('button[type="submit"]')
  await expect(submitButton).toBeVisible({ timeout: 5000 })
  await expect(submitButton).toContainText('Send Reset Link', { timeout: 5000 })

  // Also verify password field is hidden in reset mode
  await expect(page.locator('input[type="password"]')).not.toBeVisible()
})

// Visual regression test for login page
test('login page visual comparison', async ({ page }) => {
  await page.goto('/login')

  // Wait for any animations to complete and page to be fully loaded
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)

  // Wait for form to be visible
  await expect(page.locator('form')).toBeVisible()

  // Take screenshot for visual comparison
  // Increased tolerance for mobile Chrome differences
  await expect(page).toHaveScreenshot('login-page.png', {
    maxDiffPixelRatio: 0.15, // Increased tolerance for mobile browser differences
  })
})
