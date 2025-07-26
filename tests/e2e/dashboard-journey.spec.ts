import { test, expect } from '@playwright/test'
import { login } from './test-utils'

/**
 * End-to-end tests for the dashboard user journey
 *
 * This test suite covers the complete dashboard functionality including:
 * - Dashboard access and loading
 * - Navigation between dashboard sections
 * - Analytics and visualization components
 * - Dashboard interactivity
 */

test.describe('Dashboard Journey', () => {
  // Setup: login before each test
  test.beforeEach(async ({ page }) => {
    await login(page)
    // Make sure we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/)
  })

  // Dashboard loads correctly
  test('dashboard loads with all required components', async ({ page }) => {
    // Verify core dashboard elements are visible
    await expect(page.locator('h1')).toContainText(/dashboard/i)

    // Verify sidebar navigation is present
    await expect(
      page.locator('[data-testid="dashboard-sidebar"]'),
    ).toBeVisible()

    // Verify user info is displayed
    await expect(page.locator('[data-testid="user-greeting"]')).toBeVisible()

    // Verify analytics components are loaded
    await expect(
      page.locator('[data-testid="analytics-section"]'),
    ).toBeVisible()

    // Verify data visualization components (charts) are visible
    await expect(
      page.locator('[data-testid="data-visualization"]'),
    ).toBeVisible()

    // Check that at least one chart is rendered
    const chartElements = page.locator('canvas')
    await expect(chartElements).toHaveCount({ min: 1 })
  })

  // Sidebar navigation
  test('sidebar navigation works correctly', async ({ page }) => {
    // Find and click the profile link in the sidebar
    await page.click('[data-testid="sidebar-link-profile"]')

    // Verify we navigate to the profile page
    await expect(page).toHaveURL(/\/profile/)

    // Go back to dashboard
    await page.click('[data-testid="sidebar-link-dashboard"]')

    // Verify we're back on the dashboard
    await expect(page).toHaveURL(/\/dashboard/)

    // Test navigation to other sections if available
    // This will depend on your specific dashboard structure
    // Example:
    const sidebarLinks = await page
      .locator('[data-testid^="sidebar-link-"]')
      .all()

    // Skip the first two we already tested (dashboard and profile)
    for (let i = 2; i < Math.min(sidebarLinks.length, 4); i++) {
      const link = sidebarLinks[i]
      const href = await link.getAttribute('href')

      if (href && !href.includes('logout')) {
        await link.click()

        // Verify navigation worked (we're on a new page)
        await expect(page).toHaveURL(new RegExp(href.replace('/', '\\/')))

        // Go back to dashboard for next iteration
        await page.click('[data-testid="sidebar-link-dashboard"]')
      }
    }
  })

  // Data visualization interactions
  test('data visualization components are interactive', async ({ page }) => {
    // Find chart elements
    const charts = page.locator('canvas')

    // Verify charts are visible
    await expect(charts).toHaveCount({ min: 1 })

    // Attempt to interact with the first chart
    const firstChart = charts.first()

    // Click on the chart (to select a data point)
    await firstChart.click()

    // This next part will depend on how your charts behave on interaction
    // For example, clicking might show a tooltip or highlight data

    // If charts have date range selectors, test those
    const dateSelector = page.locator('[data-testid="chart-date-selector"]')
    if ((await dateSelector.count()) > 0) {
      await dateSelector.click()

      // Select a different time range option
      await page.click('text=Last 7 days')

      // Verify chart updates (this will be application-specific)
      // Could check for loading indicators or changes in the DOM
      await page.waitForSelector('[data-testid="chart-loading"]', {
        state: 'hidden',
      })
    }
  })

  // Profile section
  test('profile section displays and allows editing user information', async ({
    page,
  }) => {
    // Navigate to profile page
    await page.click('[data-testid="sidebar-link-profile"]')

    // Verify we're on the profile page
    await expect(page).toHaveURL(/\/profile/)

    // Verify profile elements are visible
    await expect(page.locator('h1')).toContainText(/profile|account/i)

    // Find edit button and click it
    await page.click('[data-testid="edit-profile-button"]')

    // Verify edit form appears
    await expect(page.locator('[data-testid="profile-form"]')).toBeVisible()

    // Update some profile information
    const newName = `Test User ${new Date().getTime()}`
    await page.fill('input[name="fullName"]', newName)

    // Submit the form
    await page.click('[data-testid="save-profile-button"]')

    // Verify success notification
    await page.waitForSelector('.toast-notification.toast-success', {
      state: 'visible',
    })

    // Verify the profile page shows the updated information
    await expect(page.locator('[data-testid="profile-name"]')).toContainText(
      newName,
    )
  })

  // Mobile responsiveness
  test('dashboard is responsive on mobile viewport', async ({ page }) => {
    // Resize page to mobile dimensions
    await page.setViewportSize({ width: 390, height: 844 }) // iPhone 12/13 size

    // Verify that mobile menu button is visible
    await expect(
      page.locator('[data-testid="mobile-menu-button"]'),
    ).toBeVisible()

    // Verify sidebar is hidden by default on mobile
    await expect(
      page.locator('[data-testid="dashboard-sidebar"]'),
    ).not.toBeVisible()

    // Click mobile menu button to open sidebar
    await page.click('[data-testid="mobile-menu-button"]')

    // Verify sidebar becomes visible
    await expect(
      page.locator('[data-testid="dashboard-sidebar"]'),
    ).toBeVisible()

    // Verify charts are still visible and properly sized
    const charts = page.locator('canvas')
    await expect(charts).toHaveCount({ min: 1 })

    // Click outside to close sidebar (if that's how your UI works)
    await page.click('h1')

    // Verify sidebar is hidden again
    await expect(
      page.locator('[data-testid="dashboard-sidebar"]'),
    ).not.toBeVisible()
  })
})
