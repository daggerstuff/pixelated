import { test, expect } from '@playwright/test'
import { login, expectToastNotification } from './test-utils'

/**
 * End-to-end tests for user experience features
 *
 * This test suite covers:
 * - Page transitions between routes
 * - Toast notifications
 * - Loading states and skeleton loaders
 * - Form interaction feedback
 */

test.describe('User Experience Features', () => {
  // Page transitions
  test('page transitions work correctly between routes', async ({ page }) => {
    // Start on the homepage
    await page.goto('/')

    // Wait for any initial page load animations
    await page.waitForTimeout(500)

    // Intercept navigation events
    let hasTransition = false

    // Listen for transition classes being added to the DOM using a proxy instead of extending Element.prototype
    await page.addInitScript(() => {
      // Store the original appendChild method
      const originalAppendChild = Element.prototype.appendChild

      // Create a proxy function that doesn't modify the prototype directly
      window._checkTransition = function (element) {
        if (
          element?.classList?.contains('astro-transition') ||
          element?.hasAttribute?.('transition:animate')
        ) {
          window._hasTransition = true
        }
      }

      // Override appendChild with a function that calls the original and then checks for transitions
      Element.prototype.appendChild = function (element) {
        const result = originalAppendChild.call(this, element)
        window._checkTransition(element)
        return result
      }
    })

    // Check for transition elements after navigation
    const checkForTransition = async () => {
      hasTransition = await page.evaluate(() => {
        return window._hasTransition === true
      })

      // Reset the flag for next check
      await page.evaluate(() => {
        window._hasTransition = false
      })

      return hasTransition
    }

    // Navigate to login page and check for transitions
    await page.click('a[href="/login"]')
    await page.waitForURL(/\/login/)

    // Verify transition happened
    expect(await checkForTransition()).toBe(true)

    // Navigate to registration page
    await page.click('a[href="/register"]')
    await page.waitForURL(/\/register/)

    // Verify transition happened
    expect(await checkForTransition()).toBe(true)

    // Navigate to password reset page
    await page.click('a:text("Forgot")')
    await page.waitForURL(/\/reset-password/)

    // Verify transition happened
    expect(await checkForTransition()).toBe(true)
  })

  // Toast notifications
  test('toast notifications display correctly', async ({ page }) => {
    // Login first to access protected features
    await login(page)

    // Navigate to profile page which might have interactive elements that trigger notifications
    await page.goto('/profile')

    // Find and click an element that would trigger a success notification
    // This could be a "Save" button or similar
    await page.click('[data-testid="edit-profile-button"]')

    // Make a simple change
    await page.fill('input[name="fullName"]', 'Test User Updated')

    // Save the changes
    await page.click('[data-testid="save-profile-button"]')

    // Verify success notification appears
    await expectToastNotification(page, /success|saved|updated/i, 'success')

    // Test that notification closes automatically or can be dismissed
    // Wait for auto-dismiss if applicable
    await page.waitForTimeout(5000)

    // Verify notification is gone
    await expect(page.locator('.toast-notification')).not.toBeVisible()

    // Trigger an error notification if possible
    // Could try submitting invalid data or similar

    // Example: Try to save with a required field empty
    await page.click('[data-testid="edit-profile-button"]')
    await page.fill('input[name="fullName"]', '')
    await page.click('[data-testid="save-profile-button"]')

    // Verify error notification appears
    await expectToastNotification(page, /error|required|invalid/i, 'error')
  })

  // Loading states
  test('loading states are shown during async operations', async ({ page }) => {
    // Login first to access protected features
    await login(page)

    // Navigate to dashboard which likely has async data loading
    await page.goto('/dashboard')

    // Verify loading states are shown
    // This could be skeleton loaders or loading spinners
    await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible()

    // Wait for content to load
    await expect(
      page.locator('[data-testid="data-visualization"]'),
    ).toBeVisible()

    // Verify loading states are hidden
    await expect(
      page.locator('[data-testid="loading-skeleton"]'),
    ).not.toBeVisible()

    // Test loading states for other async operations
    // For example, when applying filters or changing data views

    // If there's a filter or date range selector
    const dateSelector = page.locator('[data-testid="chart-date-selector"]')
    if ((await dateSelector.count()) > 0) {
      await dateSelector.click()

      // Select a different time range option
      await page.click('text=Last 7 days')

      // Verify loading indicators appear
      await expect(page.locator('[data-testid="chart-loading"]')).toBeVisible()

      // Wait for loading to complete
      await expect(
        page.locator('[data-testid="chart-loading"]'),
      ).not.toBeVisible()
    }
  })

  // Form interaction feedback
  test('forms provide proper interactive feedback', async ({ page }) => {
    // Go to login page
    await page.goto('/login')

    // Check initial state
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeEnabled()

    // Start filling the form
    const emailInput = page.locator('input[type="email"]')
    await emailInput.click()

    // Verify focus styles are applied
    const emailInputClassAfterFocus = await emailInput.evaluate(
      (el) => el.className,
    )
    expect(emailInputClassAfterFocus).toContain('focus')

    // Enter invalid email
    await emailInput.fill('invalid-email')
    await emailInput.blur()

    // Verify validation styles are applied
    await expect(emailInput).toHaveClass(/invalid|error/)

    // Enter valid email
    await emailInput.fill('test@example.com')
    await emailInput.blur()

    // Verify validation passes
    await expect(emailInput).not.toHaveClass(/invalid|error/)

    // Fill password
    await page.fill('input[type="password"]', 'password123')

    // Submit the form and check for loading state on button
    await submitButton.click()

    // Verify button shows loading state
    await expect(submitButton).toHaveClass(/loading|disabled/)

    // Verify loading state is removed after completion
    await page.waitForNavigation()

    // Go back to login page to check loading state again
    await page.goto('/login')
    await expect(submitButton).not.toHaveClass(/loading|disabled/)
  })
})
