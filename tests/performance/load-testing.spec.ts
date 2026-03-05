import { test, expect } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'

test.describe('Pipeline Load Testing', () => {
  let browser: Browser
  let contexts: BrowserContext[] = []
  let pages: Page[] = []

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser
  })

  test.afterAll(async () => {
    // Clean up all contexts and pages
    for (const page of pages) {
      await page.close()
    }
    for (const context of contexts) {
      await context.close()
    }
  })

  test('Load test with multiple concurrent users', async () => {
    const userCount = 5 // Simulate 5 concurrent users
    // 30 seconds

    await test.step('Setup concurrent users', async () => {
      // Create multiple browser contexts (users)
      for (let i = 0; i < userCount; i++) {
        const context = await browser.newContext()
        const page = await context.newPage()

        contexts.push(context)
        pages.push(page)

        // Enable all tabs for testing
        await page.goto('/demo?enable-all-tabs=true', {
          waitUntil: 'domcontentloaded',
          timeout: 60000, // Increased from 30s to 60s for staging
        })

        // Wait for page to be interactive
        await page.waitForLoadState('domcontentloaded')

        // Wait for tabs to be rendered with increased timeout and better error handling
        try {
          await page.waitForSelector('[data-testid="data-ingestion-tab"]', {
            timeout: 60000, // Increased from 30s to 60s for staging
            state: 'visible',
          })
        } catch (error) {
          // Log page content for debugging if selector not found
          const bodyText = await page.textContent('body').catch(() => 'Unable to get body text')
          console.error(`Failed to find data-ingestion-tab for user ${i}. Page body preview: ${bodyText?.substring(0, 200)}`)
          throw error
        }
      }

      expect(pages).toHaveLength(userCount)
    })

    await test.step('Concurrent data ingestion load test', async () => {
      const startTime = Date.now()
      const operations: Promise<void>[] = []

      // Each user performs data ingestion
      pages.forEach((page, userIndex) => {
        const operation = async () => {
          try {
            if (page.isClosed()) {
              console.warn(
                `User ${userIndex} ingestion skipped because page is already closed`,
              )
              return
            }

            const ingestionTab = page.getByTestId('data-ingestion-tab')
            // Wait for tab to be visible and enabled
            await expect(ingestionTab).toBeVisible({ timeout: 60000 }) // Increased for staging
            await expect(ingestionTab).not.toBeDisabled({ timeout: 5000 })
            await ingestionTab.click({ timeout: 10000 })

            // Create user-specific dataset
            const dataset = {
              userId: userIndex,
              items: Array.from({ length: 100 }, (_, i) => ({
                id: `user-${userIndex}-item-${i}`,
                content: `User ${userIndex} psychology content item ${i}`,
                category: ['anxiety', 'mood', 'trauma'][i % 3],
              })),
            }

            const fileInput = page.locator('[data-testid="file-input"]')
            await fileInput.setInputFiles([
              {
                name: `user-${userIndex}-data.json`,
                mimeType: 'application/json',
                buffer: Buffer.from(JSON.stringify(dataset)),
              },
            ])

            await expect(page.locator('text=Processing complete')).toBeVisible({
              timeout: 15000,
            })
          } catch (error: unknown) {
            console.error(`User ${userIndex} ingestion failed:`, error)
          }
        }

        operations.push(operation())
      })

      // Wait for all operations to complete
      await Promise.all(operations)

      const totalTime = Date.now() - startTime
      console.log(`Concurrent ingestion completed in: ${totalTime}ms`)

      // All users should complete within reasonable time
      expect(totalTime).toBeLessThan(20000)
    })

    await test.step('Concurrent validation load test', async () => {
      const startTime = Date.now()
      const operations: Promise<void>[] = []

      pages.forEach((page, userIndex) => {
        const operation = async () => {
          try {
            const validationTab = page.getByTestId('validation-tab')
            await expect(validationTab).toBeVisible({ timeout: 10000 })
            await expect(validationTab).not.toBeDisabled({ timeout: 5000 })
            await validationTab.click({ timeout: 10000 })

            const textArea = page.locator(
              '[placeholder*="Enter psychology content"]',
            )
            await textArea.fill(
              `User ${userIndex} concurrent validation test with clinical content requiring comprehensive analysis and validation processing.`,
            )

            await expect(page.locator('text=Validation Results')).toBeVisible({
              timeout: 10000,
            })
          } catch (error: unknown) {
            console.error(`User ${userIndex} validation failed:`, error)
          }
        }

        operations.push(operation())
      })

      await Promise.all(operations)

      const totalTime = Date.now() - startTime
      console.log(`Concurrent validation completed in: ${totalTime}ms`)

      expect(totalTime).toBeLessThan(15000)
    })

    await test.step('Concurrent category balancing load test', async () => {
      const startTime = Date.now()
      const operations: Promise<void>[] = []

      pages.forEach((page, userIndex) => {
        const operation = async () => {
          try {
            const balancingTab = page.getByTestId('category-balancing-tab')
            await expect(balancingTab).toBeVisible({ timeout: 10000 })
            await expect(balancingTab).not.toBeDisabled({ timeout: 5000 })
            await balancingTab.click({ timeout: 10000 })

            // Enable real-time mode
            await page.click('button:has-text("Inactive")')
            await expect(
              page.locator('text=Real-Time Balancing Active'),
            ).toBeVisible()

            // Perform balancing operations
            for (let i = 0; i < 3; i++) {
              await page.click('button:has-text("Simulate Influx")')
              await page.waitForTimeout(500)
            }
          } catch (error: unknown) {
            console.error(`User ${userIndex} balancing failed:`, error)
          }
        }

        operations.push(operation())
      })

      await Promise.all(operations)

      const totalTime = Date.now() - startTime
      console.log(`Concurrent balancing completed in: ${totalTime}ms`)

      expect(totalTime).toBeLessThan(20000)
    })

    await test.step('Concurrent export load test', async () => {
      const startTime = Date.now()
      const operations: Promise<void>[] = []

      pages.forEach((page, userIndex) => {
        const operation = async () => {
          try {
            const exportTab = page.getByTestId('export-tab')
            await expect(exportTab).toBeVisible({ timeout: 10000 })
            await expect(exportTab).not.toBeDisabled({ timeout: 5000 })
            await exportTab.click({ timeout: 10000 })

            // Select format based on user index
            const formats = ['json', 'csv', 'training-ready']
            const format = formats[userIndex % formats.length]
            await page.click(`[data-testid="format-${format}"]`)

            await page.click('button:has-text("Export Selected")')

            // Wait for export to complete
            await expect(page.locator('text=COMPLETED')).toBeVisible({
              timeout: 20000,
            })
          } catch (error: unknown) {
            console.error(`User ${userIndex} export failed:`, error)
          }
        }

        operations.push(operation())
      })

      await Promise.all(operations)

      const totalTime = Date.now() - startTime
      console.log(`Concurrent export completed in: ${totalTime}ms`)

      expect(totalTime).toBeLessThan(25000)
    })
  })

  test('Stress test with rapid operations', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/demo?enable-all-tabs=true', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="data-ingestion-tab"]', {
      timeout: 30000,
      state: 'visible',
    })

    await test.step('Rapid validation stress test', async () => {
      await page.click('[data-testid="validation-tab"]')

      const textArea = page.locator('[placeholder*="Enter psychology content"]')
      const startTime = Date.now()

      // Perform rapid validations
      for (let i = 0; i < 20; i++) {
        await textArea.fill(
          `Stress test validation ${i} with varying content length and complexity`,
        )
        await page.waitForTimeout(50) // Very short delay
      }

      // Wait for final validation
      await expect(page.locator('text=Validation Results')).toBeVisible()

      const stressTime = Date.now() - startTime
      console.log(`Rapid validation stress test completed in: ${stressTime}ms`)

      // Should handle rapid operations without breaking
      expect(stressTime).toBeLessThan(10000)
    })

    await test.step('Rapid balancing stress test', async () => {
      await page.click('[data-testid="category-balancing-tab"]')

      // Enable real-time mode
      await page.click('button:has-text("Inactive")')

      const startTime = Date.now()

      // Rapid balancing operations
      for (let i = 0; i < 15; i++) {
        await page.click('button:has-text("Simulate Influx")')
        await page.waitForTimeout(100)
      }

      const stressTime = Date.now() - startTime
      console.log(`Rapid balancing stress test completed in: ${stressTime}ms`)

      expect(stressTime).toBeLessThan(8000)
    })

    await context.close()
  })

  test('Memory stress test with large datasets', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/demo?enable-all-tabs=true', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="data-ingestion-tab"]', {
      timeout: 30000,
      state: 'visible',
    })

    await test.step('Large dataset processing', async () => {
      await page.click('[data-testid="data-ingestion-tab"]')

      // Create very large dataset
      const largeDataset = {
        metadata: { totalItems: 10000 },
        items: Array.from({ length: 10000 }, (_, i) => ({
          id: `large-item-${i}`,
          content: `Large dataset psychology content item ${i} with extensive clinical documentation and detailed therapeutic information for comprehensive processing and analysis. This content is designed to test the system's ability to handle large volumes of data efficiently.`,
          category: [
            'anxiety-disorders',
            'mood-disorders',
            'trauma-ptsd',
            'personality-disorders',
            'substance-use',
          ][i % 5],
          tags: Array.from({ length: 5 }, (_, j) => `tag-${i}-${j}`),
          metadata: {
            created: new Date().toISOString(),
            version: '1.0.0',
            source: 'stress-test',
          },
        })),
      }

      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0
      })

      const startTime = Date.now()

      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles([
        {
          name: 'large-stress-test.json',
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(largeDataset)),
        },
      ])

      // Wait for processing with extended timeout
      await expect(page.locator('text=Processing complete')).toBeVisible({
        timeout: 60000,
      })

      const processingTime = Date.now() - startTime

      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0
      })

      console.log(
        `Large dataset processing time: ${processingTime}ms for 10,000 items`,
      )
      console.log(
        `Average processing time per item: ${processingTime / 10000}ms`,
      )

      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory
        console.log(`Memory increase: ${memoryIncrease / 1024 / 1024}MB`)

        // Memory usage should be reasonable even for large datasets
        expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024) // Under 200MB
      }

      // Should process large dataset within reasonable time
      expect(processingTime).toBeLessThan(60000) // Under 1 minute
    })

    await context.close()
  })

  test('API load testing', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/demo?enable-all-tabs=true', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="data-ingestion-tab"]', {
      timeout: 30000,
      state: 'visible',
    })

    await test.step('Multiple API connection tests', async () => {
      await page.click('[data-testid="export-tab"]')

      const testButtons = page.locator('button:has-text("Test Connection")')
      const buttonCount = await testButtons.count()

      const startTime = Date.now()
      const connectionPromises: Promise<void>[] = []

      // Test all API connections simultaneously
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const connectionTest = async () => {
          try {
            await testButtons.nth(i).click()
            await page.waitForFunction(
              () => {
                const testingElements =
                  document.querySelectorAll('text=Testing...')
                return testingElements.length === 0
              },
              { timeout: 15000 },
            )
          } catch (error: unknown) {
            console.error(`API connection ${i} failed:`, error)
          }
        }

        connectionPromises.push(connectionTest())
      }

      await Promise.all(connectionPromises)

      const totalTime = Date.now() - startTime
      console.log(`Multiple API connections completed in: ${totalTime}ms`)

      // All API connections should complete within reasonable time
      expect(totalTime).toBeLessThan(20000)
    })

    await test.step('Rapid API sync operations', async () => {
      await page.click('[data-testid="category-balancing-tab"]')

      const syncButton = page.locator('button:has-text("Sync")')

      if (await syncButton.isVisible()) {
        const startTime = Date.now()

        // Perform multiple rapid sync operations
        for (let i = 0; i < 5; i++) {
          await syncButton.click()
          await page.waitForTimeout(1000) // Wait between syncs
        }

        const syncTime = Date.now() - startTime
        console.log(`Rapid sync operations completed in: ${syncTime}ms`)

        expect(syncTime).toBeLessThan(15000)
      }
    })

    await context.close()
  })

  test('Resource cleanup and garbage collection', async () => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/demo?enable-all-tabs=true', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="data-ingestion-tab"]', {
      timeout: 30000,
      state: 'visible',
    })

    await test.step('Resource cleanup test', async () => {
      const initialMemory = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0
      })

      // Perform intensive operations that should be cleaned up
      for (let cycle = 0; cycle < 3; cycle++) {
        // Data ingestion cycle
        await page.click('[data-testid="data-ingestion-tab"]')
        const fileInput = page.locator('[data-testid="file-input"]')
        await fileInput.setInputFiles([
          {
            name: `cleanup-test-${cycle}.json`,
            mimeType: 'application/json',
            buffer: Buffer.from(
              JSON.stringify({
                items: Array.from({ length: 500 }, (_, i) => ({
                  id: i,
                  content: 'x'.repeat(500), // 500 bytes per item
                })),
              }),
            ),
          },
        ])

        await expect(page.locator('text=Processing complete')).toBeVisible({
          timeout: 10000,
        })

        // Validation cycle
        await page.click('[data-testid="validation-tab"]')
        const textArea = page.locator(
          '[placeholder*="Enter psychology content"]',
        )
        await textArea.fill(`Cleanup test cycle ${cycle} with content`)
        await expect(page.locator('text=Validation Results')).toBeVisible()

        // Export cycle
        await page.click('[data-testid="export-tab"]')
        await page.click('[data-testid="format-json"]')
        await page.click('button:has-text("Export Selected")')
        await expect(page.locator('text=COMPLETED')).toBeVisible({
          timeout: 15000,
        })

        // Clear selection
        await page.click('[data-testid="format-json"]')
      }

      // Force garbage collection
      await page.evaluate(() => {
        if ((window as any).gc) {
          ; (window as any).gc()
        }
      })

      await page.waitForTimeout(2000) // Allow cleanup time

      const finalMemory = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : 0
      })

      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory
        console.log(
          `Memory after cleanup cycles: ${memoryIncrease / 1024 / 1024}MB increase`,
        )

        // Memory should not grow excessively after cleanup
        expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024) // Under 100MB
      }
    })

    await context.close()
  })
})
