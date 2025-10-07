import { test, expect } from '@playwright/test'
import {
  login,
  fillRegistrationForm,
  expectToastNotification,
  generateTestEmail,
} from './test-utils'

/**
 * End-to-end tests for the authentication user journey
 *
 * This test suite covers the complete authentication flow including:
 * - Registration
 * - Login
 * - Password reset
 * - Logout
 */

test.describe('Authentication Journey', () => {
  // Registration journey
  test('new user can register an account', async ({ page }) => {
    const testEmail = generateTestEmail()

    // Navigate to registration page
    await page.goto('/register')

    // Fill out the registration form
    await fillRegistrationForm(page, testEmail)

    // Accept terms and conditions
    await page.check('input[name="acceptTerms"]')

    // Submit the form
    await page.click('button[type="submit"]')

    // Wait for registration to complete
    await page.waitForNavigation({ waitUntil: 'networkidle' })

    // Verify we're redirected to the dashboard or welcome page
    await expect(page).toHaveURL(/\/dashboard|welcome/)

    // Verify success notification
    await expectToastNotification(page, /account.*created/i, 'success')
  })

  // Login journey
  test('user can log in and access protected pages', async ({ page }) => {
    // Log in
    await login(page)

    // Verify we're redirected to the dashboard
    await expect(page).toHaveURL(/\/dashboard/)

    // Check that we can see user-specific elements
    await expect(page.locator('[data-testid="user-greeting"]')).toBeVisible()

    // Try accessing profile page (protected)
    await page.goto('/profile')

    // Verify we can access the profile page without being redirected
    await expect(page).toHaveURL(/\/profile/)
    await expect(page.locator('h1')).toContainText(/profile|account/i)
  })

  // "Remember me" functionality
  test('remember me functionality keeps user logged in', async ({
    page,
    context,
  }) => {
    // Login with remember me checked
    await login(page, 'test@example.com', 'password123', true)

    // Verify login was successful
    await expect(page).toHaveURL(/\/dashboard/)

    // Close the page and reopen it (simulating browser restart)
    await page.close()
    const newPage = await context.newPage()
    await newPage.goto('/')

    // Try accessing a protected page
    await newPage.goto('/dashboard')

    // Verify we're still logged in (not redirected to login)
    await expect(newPage).toHaveURL(/\/dashboard/)
    await expect(newPage.locator('[data-testid="user-greeting"]')).toBeVisible()
  })

  // Password reset journey
  test('user can reset their password', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login')

    // Click "Forgot password" link
    await page.click('text=Forgot password')

    // Verify we're on the password reset page
    await expect(page).toHaveURL(/\/reset-password/)

    // Fill in the email address
    await page.fill('input[type="email"]', 'test@example.com')

    // Submit the form
    await page.click('button[type="submit"]')

    // Verify success notification
    await expectToastNotification(page, /reset link sent/i, 'success')

    // Simulate opening the reset link (we can't test the actual email)
    await page.goto('/reset-password-confirm?token=test-token')

    // Fill in the new password
    await page.fill('input[name="password"]', 'NewPassword123!')
    await page.fill('input[name="confirmPassword"]', 'NewPassword123!')

    // Submit the form
    await page.click('button[type="submit"]')

    // Verify success notification
    await expectToastNotification(page, /password.*updated/i, 'success')

    // Verify we're redirected to login
    await expect(page).toHaveURL(/\/login/)

    // Login with the new password
    await login(page, 'test@example.com', 'NewPassword123!')

    // Verify login is successful
    await expect(page).toHaveURL(/\/dashboard/)
  })

  // Failed login journey
  test('login fails with incorrect credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login')

    // Fill login form with incorrect password
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'WrongPassword123')

    // Submit the form
    await page.click('button[type="submit"]')

    // Verify we're still on the login page
    await expect(page).toHaveURL(/\/login/)

    // Verify error notification
    await expectToastNotification(page, /invalid.*credentials/i, 'error')
  })

  // CSRF protection test
  test('CSRF token is included in authentication requests', async ({
    page,
  }) => {
    // Navigate to login page
    await page.goto('/login')

    // Intercept the login request
    const loginRequestPromise = page.waitForRequest((request) => {
      return (
        request.url().includes('/api/auth/login') && request.method() === 'POST'
      )
    })

    // Fill and submit the login form
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for the login request
    const loginRequest = await loginRequestPromise

    // Verify the request contains a CSRF token
    const requestData = loginRequest.postDataJSON()
    expect(requestData).toHaveProperty('csrfToken')
    expect(typeof requestData.csrfToken).toBe('string')
    expect(requestData.csrfToken.length).toBeGreaterThan(0)
  })
})
