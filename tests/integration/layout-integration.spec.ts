import { test, expect } from '@playwright/test'

// Test integration between layout components and other components
test.describe('Layout Component Integration Tests', () => {
  test('Main layout renders with header and footer', async ({ page }) => {
    await page.goto('/')

    // Check that header is visible
    await expect(page.locator('header')).toBeVisible()

    // Check that the footer is visible
    await expect(page.locator('footer')).toBeVisible()

    // Check that theme toggle is present in the header
    await expect(
      page.locator('header').getByLabel(/toggle theme/i),
    ).toBeVisible()
  })

  test('Dashboard layout renders with sidebar and content area', async ({
    page,
  }) => {
    // Visit dashboard page which uses DashboardLayout
    await page.goto('/dashboard')

    // Check that sidebar is visible
    await expect(page.locator('aside')).toBeVisible()

    // Check that main content area is visible
    await expect(page.locator('main.dashboard-content')).toBeVisible()

    // Verify sidebar toggle button works
    const sidebarToggle = page.locator('button[aria-label="Toggle sidebar"]')
    await expect(sidebarToggle).toBeVisible()

    // Click the toggle button
    await sidebarToggle.click()

    // Verify sidebar state changes (has collapsed class or attribute)
    await expect(page.locator('aside')).toHaveAttribute(
      'data-collapsed',
      'true',
    )

    // Click toggle again to restore
    await sidebarToggle.click()

    // Verify sidebar is expanded again
    await expect(page.locator('aside')).not.toHaveAttribute(
      'data-collapsed',
      'true',
    )
  })

  test('Blog layout renders with correct components', async ({ page }) => {
    // Visit blog index page which uses BlogLayout
    await page.goto('/blog')

    // Check that blog header is visible
    await expect(page.locator('header.blog-header')).toBeVisible()

    // Check that blog navigation is present
    await expect(page.locator('nav.blog-navigation')).toBeVisible()

    // Check that article list is present
    await expect(page.locator('div.article-list')).toBeVisible()

    // Verify that article cards are rendered
    await expect(page.locator('.article-card')).toHaveCount.greaterThan(0)
  })

  test('Error boundary catches errors correctly', async ({ page }) => {
    // Visit a test page that intentionally triggers an error
    // This assumes we have a test route that forces an error to test ErrorBoundary
    await page.goto('/dev/error-test')

    // Check that the error boundary message is visible
    await expect(page.locator('.error-container')).toBeVisible()

    // Check that the error message contains expected text
    await expect(page.locator('.error-message')).toContainText(
      'Something went wrong',
    )

    // Check that the retry button is visible
    await expect(page.locator('button:has-text("Try Again")')).toBeVisible()
  })

  test('Client router navigation works correctly', async ({ page }) => {
    // Start at the dashboard
    await page.goto('/dashboard')

    // Wait for full page load
    await page.waitForLoadState('networkidle')

    // Find and click a navigation link
    await page.click('a[href="/dashboard/settings"]')

    // Verify URL changed
    await expect(page).toHaveURL('/dashboard/settings')

    // Verify page content updated
    await expect(page.locator('h1:has-text("Settings")')).toBeVisible()

    // Verify no full page reload occurred by checking a flag set on navigation
    // This assumes we have a client-side variable that tracks navigation type
    const isClientNavigation = await page.evaluate(() => {
      return window.sessionStorage.getItem('navigationMethod') === 'client'
    })

    expect(isClientNavigation).toBe(true)
  })
})
