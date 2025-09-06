import { test, expect } from '@playwright/test'

import path from 'path'

test.describe('Psychology Pipeline Demo - Complete Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the demo page
    await page.goto('/demo')
    await page.waitForLoadState('networkidle')
  })

  test('Complete pipeline workflow from ingestion to export', async ({
    page,
  }) => {
    // Step 1: Data Ingestion
    await test.step('Data Ingestion', async () => {
      // Navigate to data ingestion section
      await page.click('[data-testid="data-ingestion-tab"]')

      // Upload a test file
      const fileInput = page.locator('[data-testid="file-input"]')
      const testFilePath = path.join(
        __dirname,
        '../fixtures/test-psychology-data.json',
      )

      await fileInput.setInputFiles(testFilePath)

      // Wait for file processing
      await expect(page.locator('text=Processing complete')).toBeVisible({
        timeout: 10000,
      })

      // Verify file appears in the list
      await expect(page.locator('text=test-psychology-data.json')).toBeVisible()

      // Check processing statistics
      await expect(
        page.locator('[data-testid="processing-stats"]'),
      ).toBeVisible()
      await expect(page.locator('text=Items processed')).toBeVisible()
    })

    // Step 2: Content Validation
    await test.step('Content Validation', async () => {
      // Navigate to validation section
      await page.click('[data-testid="validation-tab"]')

      // Enter test content for validation
      const textArea = page.locator('[placeholder*="Enter psychology content"]')
      await textArea.fill(
        'The client presents with symptoms of generalized anxiety disorder requiring cognitive behavioral therapy intervention.',
      )

      // Wait for validation results
      await expect(page.locator('text=Validation Results')).toBeVisible({
        timeout: 5000,
      })

      // Check validation scores
      await expect(page.locator('[data-testid="overall-score"]')).toBeVisible()
      await expect(page.locator('text=Clinical Accuracy')).toBeVisible()
      await expect(page.locator('text=Ethical Compliance')).toBeVisible()

      // Verify validation passes
      const overallScore = await page
        .locator('[data-testid="overall-score"]')
        .textContent()
      expect(parseInt(overallScore || '0')).toBeGreaterThan(70)
    })

    // Step 3: Category Balancing
    await test.step('Category Balancing', async () => {
      // Navigate to category balancing section
      await page.click('[data-testid="category-balancing-tab"]')

      // Verify initial category ratios
      await expect(page.locator('text=Anxiety Disorders')).toBeVisible()
      await expect(page.locator('text=30.0%')).toBeVisible() // Target ratio

      // Enable real-time balancing
      await page.click('button:has-text("Inactive")')
      await expect(
        page.locator('text=Real-Time Balancing Active'),
      ).toBeVisible()

      // Adjust balancing speed
      const speedSlider = page.locator('[data-testid="balancing-speed-slider"]')
      await speedSlider.fill('2.0')

      // Simulate data influx
      await page.click('button:has-text("Simulate Influx")')

      // Wait for balance updates
      await page.waitForTimeout(2000)

      // Verify balance scores
      await expect(page.locator('[data-testid="balance-score"]')).toBeVisible()
      const balanceScore = await page
        .locator('[data-testid="balance-score"]')
        .textContent()
      expect(parseInt(balanceScore || '0')).toBeGreaterThan(80)
    })

    // Step 4: Results Export
    await test.step('Results Export', async () => {
      // Navigate to export section
      await page.click('[data-testid="export-tab"]')

      // Select export formats
      await page.click('[data-testid="format-json"]')
      await page.click('[data-testid="format-csv"]')
      await page.click('[data-testid="format-training-ready"]')

      // Start export process
      await page.click('button:has-text("Export Selected")')

      // Wait for export jobs to appear
      await expect(page.locator('text=Export Jobs Status')).toBeVisible()

      // Monitor export progress
      await expect(page.locator('text=PROCESSING')).toBeVisible()

      // Wait for completion (with timeout)
      await expect(page.locator('text=COMPLETED')).toBeVisible({
        timeout: 30000,
      })

      // Verify download buttons are available
      await expect(page.locator('button:has-text("Download")')).toBeVisible()

      // Generate quality reports
      await page.click('button:has-text("Generate Reports")')
      await expect(page.locator('text=Executive Summary Report')).toBeVisible({
        timeout: 10000,
      })
    })

    // Step 5: API Integration Testing
    await test.step('API Integration', async () => {
      // Test API connections
      const testConnectionButtons = page.locator(
        'button:has-text("Test Connection")',
      )
      const firstButton = testConnectionButtons.first()
      await firstButton.click()

      // Wait for connection test
      await expect(page.locator('text=Testing...')).toBeVisible()
      await expect(page.locator('text=Connected')).toBeVisible({
        timeout: 10000,
      })

      // Test data sending to training pipeline
      const sendDataButton = page
        .locator('button:has-text("Send Data")')
        .first()
      if (await sendDataButton.isVisible()) {
        await sendDataButton.click()
        await expect(page.locator('text=Data sent successfully')).toBeVisible({
          timeout: 10000,
        })
      }
    })
  })

  test('Error handling throughout the pipeline', async ({ page }) => {
    // Test file upload error handling
    await test.step('File Upload Error Handling', async () => {
      await page.click('[data-testid="data-ingestion-tab"]')

      // Try to upload an invalid file type
      const fileInput = page.locator('[data-testid="file-input"]')

      // Create a mock invalid file if it doesn't exist
      await fileInput.setInputFiles([
        {
          name: 'invalid-file.exe',
          mimeType: 'application/x-executable',
          buffer: Buffer.from('invalid content'),
        },
      ])

      // Verify error message appears
      await expect(page.locator('text=Unsupported file type')).toBeVisible()
    })

    // Test validation error handling
    await test.step('Validation Error Handling', async () => {
      await page.click('[data-testid="validation-tab"]')

      // Enter problematic content
      const textArea = page.locator('[placeholder*="Enter psychology content"]')
      await textArea.fill(
        'This content contains inappropriate language and unprofessional terminology that should trigger validation errors.',
      )

      // Wait for validation results
      await expect(page.locator('text=Issues Found')).toBeVisible()
      await expect(page.locator('text=Suggestions')).toBeVisible()
    })

    // Test API connection failures
    await test.step('API Connection Error Handling', async () => {
      await page.click('[data-testid="export-tab"]')

      // Mock API failure by intercepting network requests
      await page.route('**/api/knowledge-balancer/**', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service unavailable' }),
        })
      })

      // Try to test connection
      const testButton = page
        .locator('button:has-text("Test Connection")')
        .first()
      await testButton.click()

      // Verify error handling
      await expect(page.locator('text=Integration Error')).toBeVisible()
    })
  })

  test('Real-time features and responsiveness', async ({ page }) => {
    // Test real-time category balancing
    await test.step('Real-time Balancing', async () => {
      await page.click('[data-testid="category-balancing-tab"]')

      // Enable real-time mode
      await page.click('button:has-text("Inactive")')
      await expect(
        page.locator('text=Real-Time Balancing Active'),
      ).toBeVisible()

      // Trigger changes
      await page.click('button:has-text("Simulate Influx")')

      // Wait for updates
      await page.waitForTimeout(3000)

      // Verify element is still visible after updates
      await expect(page.locator('[data-testid="anxiety-ratio"]')).toBeVisible()
      // Note: In real scenario, ratios might change slightly
    })

    // Test export progress tracking
    await test.step('Export Progress Tracking', async () => {
      await page.click('[data-testid="export-tab"]')

      // Select a format and start export
      await page.click('[data-testid="format-json"]')
      await page.click('button:has-text("Export Selected")')

      // Monitor progress stages
      await expect(page.locator('text=Data Validation')).toBeVisible()
      await expect(page.locator('text=Data Processing')).toBeVisible()

      // Check progress bars
      const progressBars = page.locator('[role="progressbar"]')
      await expect(progressBars.first()).toBeVisible()

      // Wait for completion
      await expect(page.locator('text=COMPLETED')).toBeVisible({
        timeout: 20000,
      })
    })
  })

  test('Data persistence and state management', async ({ page }) => {
    // Test data persistence across navigation
    await test.step('Data Persistence', async () => {
      // Upload file in ingestion
      await page.click('[data-testid="data-ingestion-tab"]')
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles([
        {
          name: 'test-data.json',
          mimeType: 'application/json',
          buffer: Buffer.from('{"content": "test psychology data"}'),
        },
      ])

      await expect(page.locator('text=test-data.json')).toBeVisible()

      // Navigate to validation and back
      await page.click('[data-testid="validation-tab"]')
      await page.click('[data-testid="data-ingestion-tab"]')

      // Verify file is still there
      await expect(page.locator('text=test-data.json')).toBeVisible()
    })

    // Test state synchronization between components
    await test.step('State Synchronization', async () => {
      await page.click('[data-testid="category-balancing-tab"]')

      // Make changes to category ratios
      const resetButton = page.locator('button:has-text("Reset Defaults")')
      await resetButton.click()

      // Navigate to export
      await page.click('[data-testid="export-tab"]')

      // Verify data is reflected in export preview
      await expect(page.locator('text=Export Data Preview')).toBeVisible()

      // Check JSON preview contains category data
      await page.click('[role="tab"]:has-text("JSON")')
      await expect(page.locator('text="categories"')).toBeVisible()
    })
  })

  test('Accessibility and keyboard navigation', async ({ page }) => {
    // Test keyboard navigation
    await test.step('Keyboard Navigation', async () => {
      // Focus on first interactive element
      await page.keyboard.press('Tab')

      // Navigate through tabs using keyboard
      await page.keyboard.press('ArrowRight')
      await page.keyboard.press('ArrowRight')

      // Verify focus is visible
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    })

    // Test screen reader compatibility
    await test.step('Screen Reader Compatibility', async () => {
      // Check for proper ARIA labels
      await expect(page.locator('[aria-label]')).toHaveCount(5)

      // Check for proper heading structure
      await expect(page.locator('h1, h2, h3')).toHaveCount(3)

      // Check for alt text on images
      const images = page.locator('img')
      const imageCount = await images.count()
      if (imageCount > 0) {
        for (let i = 0; i < imageCount; i++) {
          const img = images.nth(i)
          await expect(img).toHaveAttribute('alt')
        }
      }
    })
  })

  test('Performance and loading times', async ({ page }) => {
    // Test initial page load performance
    await test.step('Page Load Performance', async () => {
      const startTime = Date.now()
      await page.goto('/demo')
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime

      // Verify page loads within reasonable time (5 seconds)
      expect(loadTime).toBeLessThan(5000)
    })

    // Test component rendering performance
    await test.step('Component Rendering Performance', async () => {
      const startTime = Date.now()

      // Navigate between tabs quickly
      await page.click('[data-testid="validation-tab"]')
      await page.click('[data-testid="category-balancing-tab"]')
      await page.click('[data-testid="export-tab"]')

      const renderTime = Date.now() - startTime

      // Verify navigation is responsive (under 2 seconds)
      expect(renderTime).toBeLessThan(2000)
    })

    // Test large data handling
    await test.step('Large Data Handling', async () => {
      await page.click('[data-testid="data-ingestion-tab"]')

      // Upload a larger file
      const largeContent = JSON.stringify({
        items: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          content: `Psychology content item ${i}`,
          category: 'anxiety-disorders',
        })),
      })

      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles([
        {
          name: 'large-dataset.json',
          mimeType: 'application/json',
          buffer: Buffer.from(largeContent),
        },
      ])

      // Verify processing completes within reasonable time
      await expect(page.locator('text=Processing complete')).toBeVisible({
        timeout: 15000,
      })
    })
  })
})
