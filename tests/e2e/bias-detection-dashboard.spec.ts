/**
 * End-to-end tests for the Bias Detection Dashboard
 *
 * The dashboard is an admin-only page (/admin/bias-detection) that renders the
 * React <BiasDashboard /> component with real-time bias monitoring, tabs for
 * trends/demographics/alerts/sessions/recommendations, an export dialog, and
 * notification settings.
 *
 * These tests authenticate via the E2E test-auth bypass (E2E_TEST_AUTH=1 in
 * CI), which issues an admin session cookie for the seeded test user without
 * requiring an Auth0 tenant.
 */

import { test, expect } from '@playwright/test'

import { login } from './test-utils'

test.describe('Bias Detection Dashboard', () => {
  // Setup: login before each test and navigate to bias dashboard
  test.beforeEach(async ({ page }) => {
    await login(page)
    // Navigate to the bias detection dashboard
    await page.goto('/admin/bias-detection')
    // Wait for the page container to render
    await page.waitForSelector('[data-testid="bias-dashboard"]', {
      state: 'visible',
    })
    // Wait for the React dashboard to mount (tabs become available)
    await page.waitForSelector('[data-testid="trends-tab"]', {
      state: 'visible',
      timeout: 15000,
    })
  })

  test.describe('Dashboard Loading and Layout', () => {
    test('loads the dashboard with header and tabs', async ({ page }) => {
      // Verify main dashboard container is present
      await expect(page.locator('[data-testid="bias-dashboard"]')).toBeVisible()

      // Verify dashboard title (scope to the React mount — the admin layout also has h1s)
      await expect(
        page.getByTestId('bias-dashboard').getByRole('heading', { level: 1 }),
      ).toContainText(/bias detection/i)

      // Verify the tab navigation is present
      await expect(page.locator('[data-testid="trends-tab"]')).toBeVisible()
      await expect(
        page.locator('[data-testid="demographics-tab"]'),
      ).toBeVisible()
      await expect(page.locator('[data-testid="alerts-tab"]')).toBeVisible()
      await expect(page.locator('[data-testid="sessions-tab"]')).toBeVisible()
      await expect(
        page.locator('[data-testid="recommendations-tab"]'),
      ).toBeVisible()

      // Verify the header action buttons are present
      await expect(
        page.locator('[data-testid="notifications-button"]'),
      ).toBeVisible()
      await expect(page.locator('[data-testid="export-button"]')).toBeVisible()

      // Verify refresh + auto-refresh controls exist
      await expect(
        page.getByRole('button', { name: /refresh dashboard data/i }),
      ).toBeVisible()
      await expect(
        page.getByRole('button', { name: /auto-refresh/i }),
      ).toBeVisible()
    })

    test('trends tab is active by default and shows summary content', async ({
      page,
    }) => {
      // Trends tab should be selected by default
      await expect(page.locator('[data-testid="trends-tab"]')).toHaveAttribute(
        'aria-selected',
        'true',
      )

      // Summary section renders inside the dashboard's primary landmark
      await expect(
        page.getByRole('main', { name: 'Dashboard main content' }),
      ).toBeVisible()
    })
  })

  test.describe('Tab Navigation', () => {
    test('switches between tabs', async ({ page }) => {
      // Switch to demographics tab
      await page.click('[data-testid="demographics-tab"]')
      await expect(
        page.locator('[data-testid="demographics-tab"]'),
      ).toHaveAttribute('aria-selected', 'true')

      // Switch to alerts tab
      await page.click('[data-testid="alerts-tab"]')
      await expect(page.locator('[data-testid="alerts-tab"]')).toHaveAttribute(
        'aria-selected',
        'true',
      )

      // Switch to sessions tab
      await page.click('[data-testid="sessions-tab"]')
      await expect(
        page.locator('[data-testid="sessions-tab"]'),
      ).toHaveAttribute('aria-selected', 'true')

      // Switch back to trends
      await page.click('[data-testid="trends-tab"]')
      await expect(page.locator('[data-testid="trends-tab"]')).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })

    test('alerts tab is keyboard accessible via tab keys', async ({ page }) => {
      const alertsTab = page.locator('[data-testid="alerts-tab"]')
      await alertsTab.focus()
      await page.keyboard.press('Enter')
      await expect(alertsTab).toHaveAttribute('aria-selected', 'true')
    })
  })

  test.describe('Notification Settings', () => {
    test('opens and closes the notification settings panel', async ({
      page,
    }) => {
      // Panel is closed initially
      await expect(
        page.locator('[data-testid="close-notification-settings"]'),
      ).toHaveCount(0)

      // Open via the header button
      await page.click('[data-testid="notifications-button"]')
      await expect(
        page.locator('[data-testid="close-notification-settings"]'),
      ).toBeVisible()

      // Verify channel + alert level toggles render
      await expect(page.getByLabel('Enable in-app notifications')).toBeVisible()
      await expect(page.getByLabel('Enable email notifications')).toBeVisible()

      // Close via the panel close button
      await page.click('[data-testid="close-notification-settings"]')
      await expect(
        page.locator('[data-testid="close-notification-settings"]'),
      ).toHaveCount(0)
    })

    test('Escape key closes the notification settings panel', async ({
      page,
    }) => {
      await page.click('[data-testid="notifications-button"]')
      await expect(
        page.locator('[data-testid="close-notification-settings"]'),
      ).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(
        page.locator('[data-testid="close-notification-settings"]'),
      ).toHaveCount(0)
    })
  })

  test.describe('Data Export', () => {
    test('opens and closes the export dialog', async ({ page }) => {
      // Dialog is closed initially
      await expect(
        page.locator('[data-testid="close-export-dialog"]'),
      ).toHaveCount(0)

      // Open via the header button
      await page.click('[data-testid="export-button"]')
      await expect(
        page.locator('[data-testid="close-export-dialog"]'),
      ).toBeVisible()

      // Verify format options and controls render (radio inputs by id)
      await expect(page.locator('#exportFormatJson')).toBeVisible()
      await expect(page.locator('#exportFormatCsv')).toBeVisible()
      await expect(page.locator('#exportFormatPdf')).toBeVisible()
      await expect(
        page.locator('[data-testid="export-data-button"]'),
      ).toBeVisible()
      await expect(page.locator('[data-testid="cancel-export"]')).toBeVisible()

      // Close via the dialog close button
      await page.click('[data-testid="close-export-dialog"]')
      await expect(
        page.locator('[data-testid="close-export-dialog"]'),
      ).toHaveCount(0)
    })

    test('cancel export closes the dialog', async ({ page }) => {
      await page.click('[data-testid="export-button"]')
      await expect(
        page.locator('[data-testid="close-export-dialog"]'),
      ).toBeVisible()

      await page.click('[data-testid="cancel-export"]')
      await expect(
        page.locator('[data-testid="close-export-dialog"]'),
      ).toHaveCount(0)
    })

    test('Escape key closes the export dialog', async ({ page }) => {
      await page.click('[data-testid="export-button"]')
      await expect(
        page.locator('[data-testid="close-export-dialog"]'),
      ).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(
        page.locator('[data-testid="close-export-dialog"]'),
      ).toHaveCount(0)
    })
  })

  test.describe('Refresh and Real-time Controls', () => {
    test('refresh button re-fetches dashboard data', async ({ page }) => {
      // Click refresh and verify the dashboard stays rendered (no error state)
      await page
        .getByRole('button', { name: /refresh dashboard data/i })
        .click()
      await expect(page.locator('[data-testid="bias-dashboard"]')).toBeVisible()
    })

    test('auto-refresh toggle updates its label', async ({ page }) => {
      const autoRefreshButton = page.getByRole('button', {
        name: /auto-refresh/i,
      })
      await expect(autoRefreshButton).toBeVisible()

      // Clicking toggles the visible state label on the same control
      await autoRefreshButton.click()
      await expect(autoRefreshButton).toContainText(/auto-refresh off/i)
    })
  })

  test.describe('Responsive Layout', () => {
    test('mobile viewport renders mobile tab variants', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // Mobile-specific tab list renders
      await expect(
        page.locator('[data-testid="sessions-tab-mobile"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="recommendations-tab-mobile"]'),
      ).toBeVisible()

      // Dashboard still present and usable
      await expect(page.locator('[data-testid="bias-dashboard"]')).toBeVisible()
    })
  })
})
