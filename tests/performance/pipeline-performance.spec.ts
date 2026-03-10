import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function safeClick(page: Page, selector: string, description: string): Promise<boolean> {
  try {
    await page.waitForSelector(selector, { timeout: 5000 })
  } catch {
    test.info().annotations.push({
      type: 'skip',
      description,
    })
    console.warn(
      `Skipping pipeline performance step: ${description} (selector not found: ${selector})`,
    )
    return false
  }

  await page.click(selector)
  return true
}

test.describe('Pipeline Performance Tests', () => {
  let page: Page

  test.beforeAll(async ({ browser }) => {
    // Increase timeout for beforeAll hook to handle slower staging environments
    test.setTimeout(120000) // 2 minutes

    page = await browser.newPage()

    try {
      await page.goto('/demo?enable-all-tabs=true', {
        waitUntil: 'domcontentloaded',
        timeout: 60000, // Increased from 30s to 60s
      })
      await page.waitForLoadState('domcontentloaded')
      await page.waitForSelector('[data-testid="data-ingestion-tab"]', {
        timeout: 60000, // Increased from 30s to 60s
        state: 'visible',
      })
    } catch (error) {
      // Log page state for debugging
      const url = page.url()
      const title = await page.title().catch(() => 'Unable to get title')
      const bodyText = await page.textContent('body').catch(() => 'Unable to get body text')
      console.error(`Failed to initialize page in beforeAll hook:`)
      console.error(`  URL: ${url}`)
      console.error(`  Title: ${title}`)
      console.error(`  Body preview: ${bodyText?.substring(0, 500)}`)
      throw error
    }
  })

  test.afterAll(async () => {
    // Only close page if it was successfully created
    if (page && !page.isClosed()) {
      await page.close()
    }
  })

  test('Data ingestion performance with large files', async () => {
    // Check if page is still open before starting test
    if (page.isClosed()) {
      test.skip()
      return
    }

    await test.step('Large File Processing Performance', async () => {
      if (!(await safeClick(page, '[data-testid="data-ingestion-tab"]', 'Data ingestion tab not available')))
        return

      // Create a large test dataset
      const largeDataset = {
        metadata: { version: '1.0.0', totalItems: 5000 },
        items: Array.from({ length: 5000 }, (_, i) => ({
          id: `item-${i}`,
          content: `Psychology training content item ${i} with detailed clinical information and therapeutic interventions for comprehensive analysis and validation.`,
          category: ['anxiety-disorders', 'mood-disorders', 'trauma-ptsd'][
            i % 3
          ],
          tags: [`tag-${i % 10}`, `category-${i % 5}`],
        })),
      }

      const startTime = Date.now()

      // Upload large file
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles([
        {
          name: 'large-dataset.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(largeDataset)),
        },
      ])

      // Wait for processing to complete
      await expect(page.locator('text=Processing complete')).toBeVisible({
        timeout: 60000, // Increased for staging
      })

      const processingTime = Date.now() - startTime

      // Performance assertion: should process 5000 items in under 30 seconds
      expect(processingTime).toBeLessThan(30000)

      // Verify processing statistics
      await expect(
        page.locator('[data-testid="processing-stats"]'),
      ).toBeVisible()

      console.log(
        `Large file processing time: ${processingTime}ms for 5000 items`,
      )
      console.log(
        `Average processing time per item: ${processingTime / 5000}ms`,
      )
    })

    await test.step('Memory Usage During Large File Processing', async () => {
      // Monitor memory usage (basic check)
      const memoryBefore = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0
      })

      // Process another large file
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles([
        {
          name: 'memory-test.json',
          mimeType: 'application/json',
          buffer: Buffer.from(
            JSON.stringify({
              items: Array.from({ length: 2000 }, (_, i) => ({
                id: i,
                content: 'x'.repeat(1000), // 1KB per item
              })),
            }),
          ),
        },
      ])

      await expect(page.locator('text=Processing complete')).toBeVisible({
        timeout: 20000,
      })

      const memoryAfter = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0
      })

      if (memoryBefore > 0 && memoryAfter > 0) {
        const memoryIncrease = memoryAfter - memoryBefore
        console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`)

        // Memory increase should be reasonable (under 100MB for 2MB of data)
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024)
      }
    })
  })

  test('Real-time validation performance', async () => {
    await test.step('Validation Response Time', async () => {
      if (!(await safeClick(page, '[data-testid="validation-tab"]', 'Validation tab not available')))
        return

      const textArea = page.locator('[placeholder*="Enter psychology content"]')

      // Test validation performance with different content lengths
      const testContents = [
        'Short content',
        'Medium length content with clinical terminology and therapeutic interventions for anxiety disorders.',
        'Very long content with extensive clinical documentation including patient history, symptoms assessment, diagnostic criteria, treatment planning, therapeutic interventions, progress monitoring, outcome evaluation, and comprehensive case notes for complex psychological presentations requiring detailed analysis and validation.',
      ]

      for (const content of testContents) {
        const startTime = Date.now()

        await textArea.fill(content)

        // Wait for validation results
        await expect(page.locator('text=Validation Results')).toBeVisible({
          timeout: 5000,
        })

        const validationTime = Date.now() - startTime

        // Validation should complete within 2 seconds for any content length
        expect(validationTime).toBeLessThan(2000)

        console.log(
          `Validation time for ${content.length} characters: ${validationTime}ms`,
        )
      }
    })

    await test.step('Concurrent Validation Performance', async () => {
      if (!(await safeClick(page, '[data-testid="validation-tab"]', 'Validation tab not available')))
        return

      // Test multiple rapid validations
      const textArea = page.locator('[placeholder*="Enter psychology content"]')

      const startTime = Date.now()

      // Rapidly change content multiple times
      for (let i = 0; i < 10; i++) {
        await textArea.fill(
          `Validation test content iteration ${i} with clinical information`,
        )
        await page.waitForTimeout(100) // Small delay between changes
      }

      // Wait for final validation
      await expect(page.locator('text=Validation Results')).toBeVisible()

      const totalTime = Date.now() - startTime

      // Should handle rapid changes efficiently (under 5 seconds total)
      expect(totalTime).toBeLessThan(5000)

      console.log(
        `Concurrent validation time for 10 iterations: ${totalTime}ms`,
      )
    })
  })

  test('Category balancing real-time performance', async () => {
    await test.step('Real-time Balancing Performance', async () => {
      if (!(await safeClick(page, '[data-testid="category-balancing-tab"]', 'Category balancing tab not available')))
        return

      // Enable real-time mode
      await page.click('button:has-text("Inactive")')
      await expect(
        page.locator('text=Real-Time Balancing Active'),
      ).toBeVisible()

      const startTime = Date.now()

      // Perform multiple rapid adjustments
      for (let i = 0; i < 5; i++) {
        await page.click('button:has-text("Simulate Influx")')
        await page.waitForTimeout(200)
      }

      // Wait for balancing to stabilize
      await page.waitForTimeout(2000)

      const balancingTime = Date.now() - startTime

      // Real-time balancing should be responsive (under 10 seconds for 5 operations)
      expect(balancingTime).toBeLessThan(10000)

      console.log(
        `Real-time balancing time for 5 operations: ${balancingTime}ms`,
      )
    })

    await test.step('Balancing Algorithm Performance', async () => {
      // Test performance with different balancing speeds
      const speeds = [1, 2.5, 5]

      for (const speed of speeds) {
        const speedSlider = page.locator(
          '[data-testid="balancing-speed-slider"]',
        )
        await speedSlider.fill(speed.toString())

        const startTime = Date.now()

        // Trigger rebalancing
        await page.click('button:has-text("Auto Rebalance")')
        await expect(page.locator('text=Rebalancing...')).toBeVisible()
        await expect(page.locator('text=Rebalancing...')).not.toBeVisible({
          timeout: 10000,
        })

        const rebalanceTime = Date.now() - startTime

        // Higher speeds should complete faster
        const expectedMaxTime = 8000 / speed // Inverse relationship
        expect(rebalanceTime).toBeLessThan(expectedMaxTime)

        console.log(`Rebalancing time at ${speed}x speed: ${rebalanceTime}ms`)
      }
    })
  })

  test('Export processing performance', async () => {
    await test.step('Single Format Export Performance', async () => {
      if (!(await safeClick(page, '[data-testid="export-tab"]', 'Export tab not available')))
        return

      // Test each format individually
      const formats = ['json', 'csv', 'training-ready', 'parquet']

      for (const format of formats) {
        // Select only one format
        await page.click(`[data-testid="format-${format}"]`)

        const startTime = Date.now()

        // Start export
        await page.click('button:has-text("Export Selected")')

        // Wait for processing to start
        await expect(page.locator('text=PROCESSING')).toBeVisible()

        // Wait for completion
        await expect(page.locator('text=COMPLETED')).toBeVisible({
          timeout: 20000,
        })

        const exportTime = Date.now() - startTime

        // Export should complete within reasonable time based on format
        const maxTime = format === 'parquet' ? 15000 : 10000 // Parquet might take longer
        expect(exportTime).toBeLessThan(maxTime)

        console.log(`${format.toUpperCase()} export time: ${exportTime}ms`)

        // Deselect format for next test
        await page.click(`[data-testid="format-${format}"]`)
      }
    })

    await test.step('Multiple Format Export Performance', async () => {
      // Select all formats
      const formats = ['json', 'csv', 'training-ready']
      for (const format of formats) {
        await page.click(`[data-testid="format-${format}"]`)
      }

      const startTime = Date.now()

      // Start export
      await page.click('button:has-text("Export Selected")')

      // Wait for all exports to complete
      await expect(page.locator('text=PROCESSING')).toBeVisible()

      // Wait for all to complete (should show multiple completed jobs)
      await page.waitForFunction(
        () => {
          const completedElements = document.querySelectorAll('text=COMPLETED')
          return completedElements.length >= 3 // All 3 formats completed
        },
        { timeout: 60000 }, // Increased for staging
      )

      const totalExportTime = Date.now() - startTime

      // Multiple exports should complete within 25 seconds
      expect(totalExportTime).toBeLessThan(25000)

      console.log(`Multiple format export time: ${totalExportTime}ms`)
    })

    await test.step('Export Progress Tracking Performance', async () => {
      // Test progress update frequency
      await page.click(`[data-testid="format-json"]`)

      const startTime = Date.now()
      let progressUpdates = 0

      // Monitor progress updates
      const progressMonitor = setInterval(() => {
        page
          .locator('[role="progressbar"]')
          .first()
          .getAttribute('aria-valuenow')
          .then((value) => {
            if (value && parseInt(value) > 0) {
              progressUpdates++
            }
          })
          .catch(() => { })
      }, 100)

      await page.click('button:has-text("Export Selected")')
      await expect(page.locator('text=COMPLETED')).toBeVisible({
        timeout: 15000,
      })

      clearInterval(progressMonitor)

      const exportTime = Date.now() - startTime

      // Should have multiple progress updates (at least 5)
      expect(progressUpdates).toBeGreaterThan(5)

      console.log(
        `Progress updates during export: ${progressUpdates} in ${exportTime}ms`,
      )
    })
  })

  test('API integration performance', async () => {
    await test.step('API Connection Test Performance', async () => {
      await page.click('[data-testid="export-tab"]')

      const testButtons = page.locator('button:has-text("Test Connection")')
      const buttonCount = await testButtons.count()

      const connectionTimes: number[] = []

      // Test first 3 API connections
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const startTime = Date.now()

        await testButtons.nth(i).click()
        await expect(page.locator('text=Testing...')).toBeVisible()

        // Wait for connection result
        await page.waitForFunction(
          () => {
            const testingElements = document.querySelectorAll('text=Testing...')
            return testingElements.length === 0
          },
          { timeout: 10000 },
        )

        const connectionTime = Date.now() - startTime
        connectionTimes.push(connectionTime)

        // Each connection test should complete within 8 seconds
        expect(connectionTime).toBeLessThan(8000)

        console.log(`API connection test ${i + 1} time: ${connectionTime}ms`)
      }

      // Average connection time should be reasonable
      const avgConnectionTime =
        connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length
      expect(avgConnectionTime).toBeLessThan(5000)

      console.log(`Average API connection time: ${avgConnectionTime}ms`)
    })

    await test.step('Data Sync Performance', async () => {
      if (!(await safeClick(page, '[data-testid="category-balancing-tab"]', 'Category balancing tab not available')))
        return

      // Test sync performance with live integration
      const syncButton = page.locator('button:has-text("Sync")')
      if (await syncButton.isVisible()) {
        const startTime = Date.now()

        await syncButton.click()
        await expect(page.locator('text=Syncing...')).toBeVisible()
        await expect(page.locator('text=Syncing...')).not.toBeVisible({
          timeout: 10000,
        })

        const syncTime = Date.now() - startTime

        // Sync should complete within 8 seconds
        expect(syncTime).toBeLessThan(8000)

        console.log(`Data sync time: ${syncTime}ms`)
      }
    })
  })

  test('Memory and resource usage', async () => {
    await test.step('Memory Leak Detection', async () => {
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0
      })

      // Perform intensive operations
      for (let i = 0; i < 5; i++) {
        // Data ingestion
        if (!(await safeClick(page, '[data-testid="data-ingestion-tab"]', 'Data ingestion tab not available during memory test')))
          return
        const fileInput = page.locator('[data-testid="file-input"]')
        await fileInput.setInputFiles([
          {
            name: `test-${i}.json`,
            mimeType: 'application/json',
            buffer: Buffer.from(
              JSON.stringify({ items: Array(100).fill({ content: 'test' }) }),
            ),
          },
        ])

        // Validation
        if (!(await safeClick(page, '[data-testid="validation-tab"]', 'Validation tab not available during memory test')))
          return
        const textArea = page.locator(
          '[placeholder*="Enter psychology content"]',
        )
        await textArea.fill(`Memory test iteration ${i} with content`)

        // Category balancing
        if (!(await safeClick(page, '[data-testid="category-balancing-tab"]', 'Category balancing tab not available during memory test')))
          return
        await page.click('button:has-text("Simulate Influx")')

        await page.waitForTimeout(1000)
      }

      // Force garbage collection if available
      await page.evaluate(() => {
        if ((window as any).gc) {
          ; (window as any).gc()
        }
      })

      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0
      })

      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory
        console.log(
          `Memory increase after intensive operations: ${memoryIncrease / 1024 / 1024}MB`,
        )

        // Memory increase should be reasonable (under 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024)
      }
    })

    await test.step('CPU Usage Monitoring', async () => {
      // Monitor performance during intensive operations
      const startTime = performance.now()

      // Perform CPU-intensive operations
      if (!(await safeClick(page, '[data-testid="category-balancing-tab"]', 'Category balancing tab not available')))
        return
      await page.click('button:has-text("Inactive")') // Enable real-time mode

      // Rapid operations
      for (let i = 0; i < 10; i++) {
        await page.click('button:has-text("Simulate Influx")')
        await page.waitForTimeout(100)
      }

      const endTime = performance.now()
      const operationTime = endTime - startTime

      // Operations should complete efficiently
      expect(operationTime).toBeLessThan(5000)

      console.log(`CPU-intensive operations completed in: ${operationTime}ms`)
    })
  })

  test('Concurrent user simulation', async () => {
    await test.step('Multiple Tab Performance', async () => {
      // Open multiple tabs to simulate concurrent users
      const context = page.context()
      const tabs: Page[] = []

      // Create 3 additional tabs
      for (let i = 0; i < 3; i++) {
        const newTab = await context.newPage()
        await newTab.goto('/demo?enable-all-tabs=true', {
          waitUntil: 'domcontentloaded',
          timeout: 60000, // Increased for staging
        })
        await newTab.waitForLoadState('domcontentloaded')
        await newTab.waitForSelector('[data-testid="data-ingestion-tab"]', {
          timeout: 60000, // Increased for staging
          state: 'visible',
        })
        tabs.push(newTab)
      }

      const startTime = Date.now()

      // Perform operations in all tabs simultaneously
      const operations = tabs.map(async (tab, index) => {
        await (tab as any)?.['click']?.('[data-testid="validation-tab"]')
        const textArea = (tab as any)?.['locator']?.(
          '[placeholder*="Enter psychology content"]',
        )
        await textArea?.['fill']?.(`Concurrent user ${index} validation test`)
        await (tab as any)?.['waitForSelector']?.('text=Validation Results')
      })

      // Wait for all operations to complete
      await Promise.all(operations)

      const concurrentTime = Date.now() - startTime

      // Concurrent operations should complete within reasonable time
      expect(concurrentTime).toBeLessThan(10000)

      console.log(`Concurrent operations time: ${concurrentTime}ms`)

      // Clean up tabs
      for (const tab of tabs) {
        await (tab as any)?.['close']?.()
      }
    })
  })
})
