import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

/**
 * Utility functions for end-to-end tests
 */

/**
 * Login to the application
 * @param page - Playwright page object
 * @param email - Email address to login with
 * @param password - Password to login with
 * @param rememberMe - Whether to check the "Remember Me" checkbox
 */
export async function login(
  page: Page,
  email: string = 'test@example.com',
  password: string = 'password123',
  rememberMe: boolean = false,
): Promise<void> {
  // Navigate to login page
  await page.goto('/login')

  // Fill login form
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)

  // Toggle remember me if needed
  if (rememberMe) {
    await page.check('input[type="checkbox"]')
  }

  // Submit the form
  await page.click('button[type="submit"]')

  // Wait for navigation to complete
  await page.waitForNavigation({ waitUntil: 'networkidle' })
}

/**
 * Log out from the application
 * @param page - Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Find and click the user menu button
  await page.click('[data-testid="user-menu-button"]')

  // Find and click the logout button
  await page.click('[data-testid="logout-button"]')

  // Wait for logout to complete and redirect
  await page.waitForNavigation({ waitUntil: 'networkidle' })

  // Verify we're logged out (redirected to login or homepage)
  await expect(page).toHaveURL(/^\/(login|index\.html)?$/)
}

/**
 * Fill the registration form
 * @param page - Playwright page object
 * @param email - Email address to register with
 * @param password - Password to register with
 * @param fullName - Full name for registration
 */
export async function fillRegistrationForm(
  page: Page,
  email: string = 'new-user@example.com',
  password: string = 'SecurePass123!',
  fullName: string = 'Test User',
): Promise<void> {
  await page.fill('input[name="fullName"]', fullName)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.fill('input[name="confirmPassword"]', password)
}

/**
 * Verify that toast notification appears
 * @param page - Playwright page object
 * @param messagePattern - Regex pattern to match in the toast message
 * @param type - Optional toast type (success, error)
 */
export async function expectToastNotification(
  page: Page,
  messagePattern: RegExp,
  type?: 'success' | 'error',
): Promise<void> {
  const toastSelector = type
    ? `.toast-notification.toast-${type}`
    : '.toast-notification'

  // Wait for the toast to appear
  await page.waitForSelector(toastSelector, { state: 'visible' })

  // Verify the message content
  const toast = page.locator(toastSelector)
  await expect(toast).toContainText(messagePattern)
}

/**
 * Generate a unique test email
 * @returns A unique email address for testing
 */
export function generateTestEmail(): string {
  const timestamp = new Date().getTime()
  const random = Math.floor(Math.random() * 10000)
  return `test-${timestamp}-${random}@example.com`
}
