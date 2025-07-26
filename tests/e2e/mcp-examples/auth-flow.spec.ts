import { test, expect } from '@playwright/test'
import { mcpSnapshot } from '@playwright/mcp'

/**
 * Authentication Flow Test for MCP Server
 *
 * This test demonstrates how to use the Playwright MCP server
 * to test the authentication flow, including login functionality
 * and session persistence.
 */

test.describe('Authentication Flow', () => {
  // Test credentials
  const testUser = {
    email: 'test@example.com',
    password: 'Password123!',
    fullName: 'Test User',
  }

  // Test admin credentials
  const adminUser = {
    email: 'admin@example.com',
    password: 'AdminPass456!',
    fullName: 'Admin User',
  }

  test('User can register a new account', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/auth/register')

    // Take MCP snapshot for context
    await mcpSnapshot(page, {
      name: 'register-page-initial',
      description: 'Initial state of the registration page',
    })

    // Fill in registration form
    await page.fill('input[name="fullName"]', testUser.fullName)
    await page.fill('input[name="email"]', testUser.email)
    await page.fill('input[name="password"]', testUser.password)
    await page.fill('input[name="confirmPassword"]', testUser.password)

    // Take MCP snapshot of filled form
    await mcpSnapshot(page, {
      name: 'register-page-filled',
      description: 'Registration form filled with test user data',
    })

    // Submit the form
    await page.click('button[type="submit"]')

    // Wait for successful registration and redirect
    await page.waitForURL('/dashboard')

    // Take MCP snapshot of post-registration state
    await mcpSnapshot(page, {
      name: 'post-registration',
      description: 'Dashboard page after successful registration',
    })

    // Verify successful registration
    await expect(page.locator('h1')).toContainText('Dashboard')
    await expect(page.locator('.user-info')).toContainText(testUser.fullName)
  })

  test('User can log in with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/login')

    // Take MCP snapshot for context
    await mcpSnapshot(page, {
      name: 'login-page-initial',
      description: 'Initial state of the login page',
    })

    // Fill in login form
    await page.fill('input[name="email"]', testUser.email)
    await page.fill('input[name="password"]', testUser.password)

    // Take MCP snapshot of filled form
    await mcpSnapshot(page, {
      name: 'login-page-filled',
      description: 'Login form filled with test user credentials',
    })

    // Check "Remember me" option
    await page.check('input[name="rememberMe"]')

    // Submit the form
    await page.click('button[type="submit"]')

    // Wait for successful login and redirect
    await page.waitForURL('/dashboard')

    // Take MCP snapshot of post-login state
    await mcpSnapshot(page, {
      name: 'post-login',
      description: 'Dashboard page after successful login',
    })

    // Verify successful login
    await expect(page.locator('h1')).toContainText('Dashboard')
    await expect(page.locator('.user-info')).toContainText(testUser.fullName)
  })

  test('Authentication keeps user logged in across sessions', async ({
    page,
  }) => {
    // First login with "Remember me" checked
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', testUser.email)
    await page.fill('input[name="password"]', testUser.password)
    await page.check('input[name="rememberMe"]')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    // Verify login was successful
    await expect(page.locator('h1')).toContainText('Dashboard')

    // Take MCP snapshot of logged-in state
    await mcpSnapshot(page, {
      name: 'authenticated-session',
      description: 'User session is authenticated',
    })

    // Close and reopen browser (simulate new session)
    await page.context().close()
    const newContext = await page.context().browser().newContext()
    const newPage = await newContext.newPage()

    // Go directly to a protected page
    await newPage.goto('/dashboard')

    // Take MCP snapshot of persistence check
    await mcpSnapshot(newPage, {
      name: 'session-persistence',
      description: 'Checking if session persists after browser restart',
    })

    // Verify user is still logged in (not redirected to login)
    await expect(newPage).toHaveURL('/dashboard')
    await expect(newPage.locator('h1')).toContainText('Dashboard')
    await expect(newPage.locator('.user-info')).toContainText(testUser.fullName)
  })

  test('User cannot log in with invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/login')

    // Fill in login form with invalid password
    await page.fill('input[name="email"]', testUser.email)
    await page.fill('input[name="password"]', 'WrongPassword123!')

    // Take MCP snapshot of invalid credentials
    await mcpSnapshot(page, {
      name: 'login-invalid-credentials',
      description: 'Login form with invalid credentials',
    })

    // Submit the form
    await page.click('button[type="submit"]')

    // Verify error message is displayed
    await expect(page.locator('.error-message')).toBeVisible()
    await expect(page.locator('.error-message')).toContainText(
      'Invalid email or password',
    )

    // Take MCP snapshot of error state
    await mcpSnapshot(page, {
      name: 'login-error-state',
      description: 'Login page showing error message for invalid credentials',
    })

    // Verify we are still on the login page
    await expect(page).toHaveURL('/auth/login')
  })

  test('User can reset password', async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/login')

    // Click on "Forgot password" link
    await page.click('a:has-text("Forgot password")')

    // Wait for password reset page
    await expect(page).toHaveURL('/auth/forgot-password')

    // Take MCP snapshot of password reset page
    await mcpSnapshot(page, {
      name: 'forgot-password-page',
      description: 'Password reset request page',
    })

    // Fill in email
    await page.fill('input[name="email"]', testUser.email)

    // Submit the form
    await page.click('button[type="submit"]')

    // Verify success message
    await expect(page.locator('.success-message')).toBeVisible()
    await expect(page.locator('.success-message')).toContainText(
      'Password reset link sent',
    )

    // Take MCP snapshot of success state
    await mcpSnapshot(page, {
      name: 'password-reset-request-success',
      description: 'Success message after password reset request',
    })
  })

  test('Admin user has access to admin features', async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', adminUser.email)
    await page.fill('input[name="password"]', adminUser.password)
    await page.click('button[type="submit"]')

    // Wait for login and redirect
    await page.waitForURL('/dashboard')

    // Take MCP snapshot of admin dashboard
    await mcpSnapshot(page, {
      name: 'admin-dashboard',
      description: 'Dashboard as viewed by admin user',
    })

    // Navigate to admin section
    await page.click('a:has-text("Admin")')

    // Wait for admin page to load
    await expect(page).toHaveURL('/admin')

    // Verify admin-only content is visible
    await expect(page.locator('h1')).toContainText('Admin Dashboard')
    await expect(page.locator('.admin-controls')).toBeVisible()

    // Take MCP snapshot of admin page
    await mcpSnapshot(page, {
      name: 'admin-page',
      description: 'Admin page showing admin-only controls',
    })
  })
})
