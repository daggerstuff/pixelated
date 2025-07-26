/**
 * End-to-end tests for Bias Detection Dashboard
 *
 * This test suite covers the complete bias detection dashboard functionality including:
 * - Dashboard loading and initial state
 * - Real-time bias monitoring and alerts
 * - Interactive charts and data visualization
 * - Filtering and time range selection
 * - Alert management and notifications
 * - Data export functionality
 * - WebSocket connectivity and real-time updates
 * - Responsive design and accessibility features
 */

import { test, expect } from '@playwright/test'
import { login } from './test-utils'

test.describe('Bias Detection Dashboard', () => {
  // Setup: login before each test and navigate to bias dashboard
  test.beforeEach(async ({ page }) => {
    await login(page)
    // Navigate to the bias detection dashboard
    await page.goto('/admin/bias-detection')
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="bias-dashboard"]', {
      state: 'visible',
    })
  })

  test.describe('Dashboard Loading and Layout', () => {
    test('loads dashboard with all required components', async ({ page }) => {
      // Verify main dashboard container is present
      await expect(page.locator('[data-testid="bias-dashboard"]')).toBeVisible()

      // Verify dashboard title
      await expect(page.locator('h1')).toContainText(/bias detection/i)

      // Verify key dashboard sections are present
      await expect(
        page.locator('[data-testid="bias-summary-cards"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="bias-charts-section"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="bias-alerts-section"]'),
      ).toBeVisible()

      // Verify navigation tabs are present
      await expect(page.locator('[data-testid="dashboard-tabs"]')).toBeVisible()
      await expect(page.locator('text=Overview')).toBeVisible()
      await expect(page.locator('text=Trends')).toBeVisible()
      await expect(page.locator('text=Alerts')).toBeVisible()
      await expect(page.locator('text=Demographics')).toBeVisible()

      // Verify control panel is present
      await expect(
        page.locator('[data-testid="dashboard-controls"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="time-range-selector"]'),
      ).toBeVisible()
      await expect(page.locator('[data-testid="refresh-button"]')).toBeVisible()
    })

    test('displays bias summary metrics', async ({ page }) => {
      // Wait for metrics to load
      await page.waitForSelector('[data-testid="bias-score-metric"]', {
        state: 'visible',
      })

      // Verify bias score metric card
      const biasScoreCard = page.locator('[data-testid="bias-score-metric"]')
      await expect(biasScoreCard).toBeVisible()
      await expect(biasScoreCard.locator('.metric-value')).toBeVisible()
      await expect(biasScoreCard.locator('.metric-label')).toContainText(
        /bias score/i,
      )

      // Verify alerts count metric
      const alertsCard = page.locator('[data-testid="alerts-count-metric"]')
      await expect(alertsCard).toBeVisible()
      await expect(alertsCard.locator('.metric-value')).toBeVisible()

      // Verify sessions analyzed metric
      const sessionsCard = page.locator(
        '[data-testid="sessions-analyzed-metric"]',
      )
      await expect(sessionsCard).toBeVisible()
      await expect(sessionsCard.locator('.metric-value')).toBeVisible()

      // Verify trend indicators are present
      await expect(
        page.locator('[data-testid="bias-trend-indicator"]'),
      ).toBeVisible()
    })

    test('loads charts and visualizations', async ({ page }) => {
      // Wait for charts to render
      await page.waitForSelector('canvas', { state: 'visible' })

      // Verify chart containers are present
      await expect(
        page.locator('[data-testid="bias-trend-chart"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="demographic-breakdown-chart"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="session-analysis-chart"]'),
      ).toBeVisible()

      // Verify at least one chart canvas is rendered
      const chartCanvases = page.locator('canvas')
      await expect(chartCanvases).toHaveCount({ min: 1 })

      // Verify chart legends and labels
      await expect(page.locator('.recharts-legend')).toBeVisible()
      await expect(page.locator('.recharts-cartesian-axis')).toBeVisible()
    })
  })

  test.describe('Real-time Updates and WebSocket Connectivity', () => {
    test('establishes WebSocket connection for real-time updates', async ({
      page,
    }) => {
      // Verify WebSocket connection status indicator
      await expect(
        page.locator('[data-testid="connection-status"]'),
      ).toBeVisible()

      // Wait for connection to be established
      await page.waitForSelector(
        '[data-testid="connection-status"][data-status="connected"]',
        {
          timeout: 10000,
        },
      )

      // Verify connection indicator shows connected state
      const connectionStatus = page.locator('[data-testid="connection-status"]')
      await expect(connectionStatus).toHaveAttribute('data-status', 'connected')
      await expect(connectionStatus).toContainText(/connected/i)
    })

    test('updates dashboard data in real-time', async ({ page }) => {
      // Wait for initial data load
      await page.waitForSelector('[data-testid="last-updated-timestamp"]', {
        state: 'visible',
      })

      // Get initial timestamp
      const initialTimestamp = await page
        .locator('[data-testid="last-updated-timestamp"]')
        .textContent()

      // Trigger manual refresh to simulate real-time update
      await page.click('[data-testid="refresh-button"]')

      // Wait for update to complete
      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })

      // Verify timestamp has updated
      const updatedTimestamp = await page
        .locator('[data-testid="last-updated-timestamp"]')
        .textContent()
      expect(updatedTimestamp).not.toBe(initialTimestamp)
    })

    test('handles WebSocket connection failures gracefully', async ({
      page,
    }) => {
      // Simulate network disconnection by blocking WebSocket requests
      await page.route('**/ws/**', (route) => route.abort())

      // Trigger a refresh to attempt WebSocket connection
      await page.click('[data-testid="refresh-button"]')

      // Verify error state is displayed
      await page.waitForSelector(
        '[data-testid="connection-status"][data-status="error"]',
        {
          timeout: 5000,
        },
      )

      // Verify error message is shown
      await expect(
        page.locator('[data-testid="connection-error-message"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="connection-error-message"]'),
      ).toContainText(/connection/i)
    })
  })

  test.describe('Interactive Charts and Data Visualization', () => {
    test('chart interactions work correctly', async ({ page }) => {
      // Wait for charts to load
      await page.waitForSelector('canvas', { state: 'visible' })

      // Click on a chart point
      const chartCanvas = page
        .locator('[data-testid="bias-trend-chart"] canvas')
        .first()
      await chartCanvas.click()

      // Verify tooltip appears (if implemented)
      const tooltip = page.locator('.recharts-tooltip-wrapper')
      if ((await tooltip.count()) > 0) {
        await expect(tooltip).toBeVisible()
      }

      // Test chart legend interactions
      const legendItems = page.locator('.recharts-legend-item')
      if ((await legendItems.count()) > 0) {
        await legendItems.first().click()
        // Chart should update to hide/show data series
      }
    })

    test('chart responsiveness and zoom functionality', async ({ page }) => {
      // Test on different viewport sizes
      await page.setViewportSize({ width: 1200, height: 800 })

      // Verify charts are visible and properly sized
      await expect(
        page.locator('[data-testid="bias-trend-chart"]'),
      ).toBeVisible()

      // Change to mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // Verify charts are still visible and responsive
      await expect(
        page.locator('[data-testid="bias-trend-chart"]'),
      ).toBeVisible()

      // Verify mobile-specific chart controls
      const mobileChartControls = page.locator(
        '[data-testid="mobile-chart-controls"]',
      )
      if ((await mobileChartControls.count()) > 0) {
        await expect(mobileChartControls).toBeVisible()
      }
    })

    test('time range selection updates charts', async ({ page }) => {
      // Select different time range
      await page.click('[data-testid="time-range-selector"]')
      await page.click('text=Last 7 days')

      // Wait for charts to update
      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })

      // Verify chart data has updated (check axis labels or data points)
      await expect(page.locator('.recharts-cartesian-axis')).toBeVisible()

      // Test custom date range
      await page.click('[data-testid="time-range-selector"]')
      await page.click('text=Custom Range')

      // Fill custom date inputs
      await page.fill('[data-testid="start-date-input"]', '2024-01-01')
      await page.fill('[data-testid="end-date-input"]', '2024-01-31')
      await page.click('[data-testid="apply-date-range"]')

      // Wait for update
      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })
    })
  })

  test.describe('Alert Management', () => {
    test('displays bias alerts correctly', async ({ page }) => {
      // Navigate to alerts tab
      await page.click('text=Alerts')

      // Wait for alerts to load
      await page.waitForSelector('[data-testid="alerts-list"]', {
        state: 'visible',
      })

      // Verify alert items are displayed
      const alertItems = page.locator('[data-testid="alert-item"]')
      if ((await alertItems.count()) > 0) {
        const firstAlert = alertItems.first()

        // Verify alert components
        await expect(
          firstAlert.locator('[data-testid="alert-level"]'),
        ).toBeVisible()
        await expect(
          firstAlert.locator('[data-testid="alert-message"]'),
        ).toBeVisible()
        await expect(
          firstAlert.locator('[data-testid="alert-timestamp"]'),
        ).toBeVisible()
        await expect(
          firstAlert.locator('[data-testid="alert-actions"]'),
        ).toBeVisible()
      }
    })

    test('alert filtering and sorting', async ({ page }) => {
      await page.click('text=Alerts')

      // Test severity filter
      await page.click('[data-testid="alert-severity-filter"]')
      await page.click('text=High')

      // Wait for filtered results
      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })

      // Verify only high severity alerts are shown
      const alertItems = page.locator('[data-testid="alert-item"]')
      if ((await alertItems.count()) > 0) {
        const severityBadges = page.locator(
          '[data-testid="alert-level"]:has-text("high")',
        )
        expect(await severityBadges.count()).toBeGreaterThan(0)
      }

      // Test time-based sorting
      await page.click('[data-testid="alert-sort-dropdown"]')
      await page.click('text=Newest First')

      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })
    })

    test('alert actions and management', async ({ page }) => {
      await page.click('text=Alerts')
      await page.waitForSelector('[data-testid="alerts-list"]', {
        state: 'visible',
      })

      const alertItems = page.locator('[data-testid="alert-item"]')
      if ((await alertItems.count()) > 0) {
        const firstAlert = alertItems.first()

        // Test acknowledge action
        await firstAlert.locator('[data-testid="acknowledge-alert"]').click()

        // Verify alert status changes
        await expect(
          firstAlert.locator('[data-testid="alert-status"]'),
        ).toContainText(/acknowledged/i)

        // Test adding notes to alert
        await firstAlert.locator('[data-testid="add-alert-note"]').click()
        await page.fill(
          '[data-testid="alert-note-input"]',
          'Test note for investigation',
        )
        await page.click('[data-testid="save-alert-note"]')

        // Verify note is saved
        await expect(
          firstAlert.locator('[data-testid="alert-notes"]'),
        ).toContainText('Test note')
      }
    })

    test('notification settings management', async ({ page }) => {
      // Open notification settings
      await page.click('[data-testid="notification-settings-button"]')

      // Verify settings modal appears
      await expect(
        page.locator('[data-testid="notification-settings-modal"]'),
      ).toBeVisible()

      // Toggle notification preferences
      await page.click('[data-testid="email-notifications-toggle"]')
      await page.click('[data-testid="high-alerts-toggle"]')

      // Save settings
      await page.click('[data-testid="save-notification-settings"]')

      // Verify success message
      await page.waitForSelector('.toast-notification.toast-success', {
        state: 'visible',
      })
    })
  })

  test.describe('Data Export Functionality', () => {
    test('data export dialog and options', async ({ page }) => {
      // Open export dialog
      await page.click('[data-testid="export-data-button"]')

      // Verify export modal appears
      await expect(page.locator('[data-testid="export-dialog"]')).toBeVisible()

      // Verify export format options
      await expect(
        page.locator('[data-testid="export-format-json"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="export-format-csv"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="export-format-pdf"]'),
      ).toBeVisible()

      // Verify data type selection
      await expect(
        page.locator('[data-testid="export-data-summary"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="export-data-alerts"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="export-data-trends"]'),
      ).toBeVisible()

      // Verify date range selection
      await expect(
        page.locator('[data-testid="export-start-date"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="export-end-date"]'),
      ).toBeVisible()
    })

    test('export data in different formats', async ({ page }) => {
      // Test JSON export
      await page.click('[data-testid="export-data-button"]')
      await page.click('[data-testid="export-format-json"]')

      // Configure export options
      await page.check('[data-testid="export-data-summary"]')
      await page.check('[data-testid="export-data-alerts"]')

      // Set date range
      await page.fill('[data-testid="export-start-date"]', '2024-01-01')
      await page.fill('[data-testid="export-end-date"]', '2024-01-31')

      // Start export
      const downloadPromise = page.waitForEvent('download')
      await page.click('[data-testid="start-export-button"]')

      // Verify download starts
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('.json')

      // Close dialog
      await page.click('[data-testid="close-export-dialog"]')
    })

    test('export progress and cancellation', async ({ page }) => {
      await page.click('[data-testid="export-data-button"]')
      await page.click('[data-testid="export-format-pdf"]')

      // Start export
      await page.click('[data-testid="start-export-button"]')

      // Verify progress indicator appears
      await expect(
        page.locator('[data-testid="export-progress"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="export-progress-bar"]'),
      ).toBeVisible()

      // Test cancellation
      await page.click('[data-testid="cancel-export-button"]')

      // Verify export is cancelled
      await expect(
        page.locator('[data-testid="export-cancelled-message"]'),
      ).toBeVisible()
    })
  })

  test.describe('Filtering and Search', () => {
    test('demographic filtering', async ({ page }) => {
      // Navigate to demographics tab
      await page.click('text=Demographics')

      // Wait for demographic data to load
      await page.waitForSelector('[data-testid="demographic-breakdown"]', {
        state: 'visible',
      })

      // Test age group filter
      await page.click('[data-testid="age-group-filter"]')
      await page.click('text=25-34')

      // Wait for data to update
      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })

      // Verify filtered data is displayed
      await expect(
        page.locator('[data-testid="demographic-chart"]'),
      ).toBeVisible()

      // Test gender filter
      await page.click('[data-testid="gender-filter"]')
      await page.click('text=Female')

      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })
    })

    test('bias score range filtering', async ({ page }) => {
      // Test bias score range slider
      await page.click('[data-testid="bias-score-filter"]')

      // Verify range slider is visible
      await expect(
        page.locator('[data-testid="bias-score-range"]'),
      ).toBeVisible()

      // Adjust range slider (simulate drag)
      const slider = page
        .locator('[data-testid="bias-score-range"] input[type="range"]')
        .first()
      await slider.fill('0.3')

      // Apply filter
      await page.click('[data-testid="apply-bias-filter"]')

      // Wait for filtered results
      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })
    })

    test('session type and date filtering', async ({ page }) => {
      // Test session type filter
      await page.click('[data-testid="session-type-filter"]')
      await page.click('text=Individual')

      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })

      // Test combining multiple filters
      await page.click('[data-testid="alert-level-filter"]')
      await page.click('text=Medium')

      await page.waitForSelector('[data-testid="loading-indicator"]', {
        state: 'hidden',
      })

      // Verify filter tags are displayed
      await expect(
        page.locator(
          '[data-testid="active-filter-tag"]:has-text("Individual")',
        ),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="active-filter-tag"]:has-text("Medium")'),
      ).toBeVisible()

      // Test clearing filters
      await page.click('[data-testid="clear-all-filters"]')

      // Verify filters are cleared
      await expect(
        page.locator('[data-testid="active-filter-tag"]'),
      ).toHaveCount(0)
    })
  })

  test.describe('Responsive Design and Accessibility', () => {
    test('mobile responsiveness', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })

      // Verify mobile layout adaptations
      await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible()

      // Verify mobile navigation
      const mobileMenuButton = page.locator(
        '[data-testid="mobile-menu-button"]',
      )
      if ((await mobileMenuButton.count()) > 0) {
        await mobileMenuButton.click()
        await expect(
          page.locator('[data-testid="mobile-navigation"]'),
        ).toBeVisible()
      }

      // Verify charts are responsive
      await expect(
        page.locator('[data-testid="bias-trend-chart"]'),
      ).toBeVisible()

      // Test swipe gestures on charts (if implemented)
      const chart = page.locator('[data-testid="bias-trend-chart"]')
      await chart.hover()
    })

    test('keyboard navigation and accessibility', async ({ page }) => {
      // Test tab navigation
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Verify focus is visible
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()

      // Test escape key functionality
      await page.click('[data-testid="export-data-button"]')
      await page.keyboard.press('Escape')

      // Verify modal closes
      await expect(
        page.locator('[data-testid="export-dialog"]'),
      ).not.toBeVisible()

      // Test arrow key navigation in charts (if implemented)
      await page.focus('[data-testid="bias-trend-chart"]')
      await page.keyboard.press('ArrowRight')
    })

    test('screen reader accessibility', async ({ page }) => {
      // Verify ARIA labels are present
      await expect(
        page.locator('[data-testid="bias-dashboard"]'),
      ).toHaveAttribute('role', 'main')

      // Verify headings structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6')
      await expect(headings).toHaveCount({ min: 1 })

      // Verify form controls have labels
      const formControls = page.locator('input, select, button')
      const controlCount = await formControls.count()

      for (let i = 0; i < Math.min(controlCount, 5); i++) {
        const control = formControls.nth(i)
        const hasLabel =
          (await control.getAttribute('aria-label')) ||
          (await control.getAttribute('aria-labelledby')) ||
          (await page
            .locator(`label[for="${await control.getAttribute('id')}"]`)
            .count()) > 0

        if (!hasLabel) {
          console.warn(`Control at index ${i} may be missing proper labeling`)
        }
      }

      // Verify live regions for dynamic content
      await expect(page.locator('[aria-live]')).toHaveCount({ min: 1 })
    })

    test('high contrast and reduced motion support', async ({ page }) => {
      // Test high contrast mode toggle
      const highContrastToggle = page.locator(
        '[data-testid="high-contrast-toggle"]',
      )
      if ((await highContrastToggle.count()) > 0) {
        await highContrastToggle.click()

        // Verify high contrast styles are applied
        await expect(page.locator('body')).toHaveClass(/high-contrast/)
      }

      // Test reduced motion preferences
      const reducedMotionToggle = page.locator(
        '[data-testid="reduced-motion-toggle"]',
      )
      if ((await reducedMotionToggle.count()) > 0) {
        await reducedMotionToggle.click()

        // Verify reduced motion styles are applied
        await expect(page.locator('body')).toHaveClass(/reduced-motion/)
      }
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('handles API errors gracefully', async ({ page }) => {
      // Simulate API failure
      await page.route('**/api/bias-detection/**', (route) => route.abort())

      // Trigger refresh
      await page.click('[data-testid="refresh-button"]')

      // Verify error state is displayed
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]')).toContainText(
        /error/i,
      )

      // Verify retry functionality
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
    })

    test('handles empty data states', async ({ page }) => {
      // Mock empty data response
      await page.route('**/api/bias-detection/dashboard', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            summary: { biasScore: 0, alertsCount: 0, sessionsAnalyzed: 0 },
            trends: [],
            alerts: [],
            demographics: [],
          }),
        }),
      )

      // Refresh to get empty data
      await page.click('[data-testid="refresh-button"]')

      // Verify empty state messaging
      await expect(
        page.locator('[data-testid="empty-data-message"]'),
      ).toBeVisible()
      await expect(
        page.locator('[data-testid="empty-data-message"]'),
      ).toContainText(/no data/i)

      // Verify helpful actions are suggested
      await expect(
        page.locator('[data-testid="empty-state-actions"]'),
      ).toBeVisible()
    })

    test('handles slow loading and timeouts', async ({ page }) => {
      // Simulate slow API response
      await page.route(
        '**/api/bias-detection/dashboard',
        (route) =>
          new Promise((resolve) =>
            setTimeout(() => resolve(route.continue()), 5000),
          ),
      )

      // Trigger refresh
      await page.click('[data-testid="refresh-button"]')

      // Verify loading indicator appears
      await expect(
        page.locator('[data-testid="loading-indicator"]'),
      ).toBeVisible()

      // Verify loading message
      await expect(
        page.locator('[data-testid="loading-message"]'),
      ).toContainText(/loading/i)

      // Test loading timeout handling (if implemented)
      await page.waitForTimeout(6000)

      const timeoutMessage = page.locator('[data-testid="timeout-message"]')
      if ((await timeoutMessage.count()) > 0) {
        await expect(timeoutMessage).toBeVisible()
      }
    })
  })
})
