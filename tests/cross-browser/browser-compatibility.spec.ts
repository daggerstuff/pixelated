import { test, expect, devices } from '@playwright/test'
import type { Browser, BrowserContext, Page } from '@playwright/test'

// Define browsers to test
const browsers = ['chromium', 'firefox', 'webkit'] as const

// Test on different browser engines
browsers.forEach((browserName) => {
  test.describe(`Cross-Browser Compatibility - ${browserName}`, () => {
    let browser: Browser
    let context: BrowserContext
    let page: Page

    test.beforeAll(async ({ playwright }) => {
      browser = await playwright[browserName].launch()
      context = await browser.newContext()
      page = await context.newPage()
    })

    test.afterAll(async () => {
      await context.close()
      await browser.close()
    })

    test.beforeEach(async () => {
      await page.goto('/demo')
      await page.waitForLoadState('networkidle')
    })

    test('Basic page functionality works across browsers', async () => {
      await test.step('Page loads and renders correctly', async () => {
        // Check that main elements are visible
        await expect(
          page.locator('text=Psychology Pipeline Demo'),
        ).toBeVisible()
        await expect(
          page.locator('[data-testid="data-ingestion-tab"]'),
        ).toBeVisible()
        await expect(
          page.locator('[data-testid="validation-tab"]'),
        ).toBeVisible()
        await expect(
          page.locator('[data-testid="category-balancing-tab"]'),
        ).toBeVisible()
        await expect(page.locator('[data-testid="export-tab"]')).toBeVisible()
      })

      await test.step('Navigation between tabs works', async () => {
        // Test tab navigation
        await page.click('[data-testid="validation-tab"]')
        await expect(
          page.locator('[data-testid="validation-section"]'),
        ).toBeVisible()

        await page.click('[data-testid="category-balancing-tab"]')
        await expect(
          page.locator('[data-testid="category-balancing-section"]'),
        ).toBeVisible()

        await page.click('[data-testid="export-tab"]')
        await expect(
          page.locator('[data-testid="export-section"]'),
        ).toBeVisible()

        await page.click('[data-testid="data-ingestion-tab"]')
        await expect(
          page.locator('[data-testid="data-ingestion-section"]'),
        ).toBeVisible()
      })

      await test.step('Interactive elements respond correctly', async () => {
        // Test buttons
        const buttons = page.locator('button')
        const buttonCount = await buttons.count()
        expect(buttonCount).toBeGreaterThan(0)

        // Test first few buttons
        for (let i = 0; i < Math.min(buttonCount, 5); i++) {
          const button = buttons.nth(i)
          if ((await button.isVisible()) && (await button.isEnabled())) {
            await button.hover()
            // Button should be hoverable without errors
          }
        }
      })
    })

    test('File upload functionality across browsers', async () => {
      await test.step('File input works correctly', async () => {
        await page.click('[data-testid="data-ingestion-tab"]')

        const fileInput = page.locator('[data-testid="file-input"]')
        await expect(fileInput).toBeVisible()

        // Test file upload
        await fileInput.setInputFiles([
          {
            name: 'test-file.json',
            mimeType: 'application/json',
            buffer: Buffer.from('{"test": "data"}'),
          },
        ])

        // Should show uploaded file
        await expect(page.locator('text=test-file.json')).toBeVisible({
          timeout: 10000,
        })
      })

      await test.step('Drag and drop works (where supported)', async () => {
        const uploadArea = page.locator('[data-testid="upload-area"]')

        if (await uploadArea.isVisible()) {
          // Test drag enter/leave events
          await uploadArea.hover()

          // Simulate drag events (basic test)
          await page.dispatchEvent('[data-testid="upload-area"]', 'dragenter')
          await page.dispatchEvent('[data-testid="upload-area"]', 'dragleave')

          // Should not cause errors
        }
      })
    })

    test('Form inputs and validation across browsers', async () => {
      await test.step('Text input and validation', async () => {
        await page.click('[data-testid="validation-tab"]')

        const textArea = page.locator(
          '[placeholder*="Enter psychology content"]',
        )
        await expect(textArea).toBeVisible()

        // Test text input
        await textArea.fill('Test content for cross-browser validation')

        // Should show validation results
        await expect(page.locator('text=Validation Results')).toBeVisible({
          timeout: 5000,
        })
      })

      await test.step('Slider controls work correctly', async () => {
        await page.click('[data-testid="category-balancing-tab"]')

        const sliders = page.locator('[role="slider"]')
        const sliderCount = await sliders.count()

        if (sliderCount > 0) {
          const firstSlider = sliders.first()
          await expect(firstSlider).toBeVisible()

          // Test slider interaction
          // Get initial value but don't assert on it since we're just checking for errors
          await firstSlider.getAttribute('aria-valuenow')

          // Try to change slider value
          await firstSlider.focus()
          await page.keyboard.press('ArrowRight')

          // Just check that the operation doesn't throw an error
          // Some browsers might not support keyboard slider control
          await firstSlider.getAttribute('aria-valuenow')
        }
      })
    })

    test('CSS and styling consistency across browsers', async () => {
      await test.step('Layout and positioning', async () => {
        // Check that key elements are positioned correctly
        const mainContent = page.locator('[data-testid="main-content"]')
        if (await mainContent.isVisible()) {
          const boundingBox = await mainContent.boundingBox()
          expect(boundingBox?.width).toBeGreaterThan(300)
          expect(boundingBox?.height).toBeGreaterThan(200)
        }
      })

      await test.step('Colors and visual elements', async () => {
        // Check that styled elements have proper colors
        const buttons = page.locator('button').first()
        if (await buttons.isVisible()) {
          const styles = await buttons.evaluate((el) => {
            const computed = window.getComputedStyle(el)
            return {
              backgroundColor: computed.backgroundColor,
              color: computed.color,
              borderRadius: computed.borderRadius,
            }
          })

          // Should have some styling applied
          expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
        }
      })

      await test.step('Responsive design elements', async () => {
        // Test different viewport sizes
        await page.setViewportSize({ width: 1200, height: 800 })
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible()

        await page.setViewportSize({ width: 768, height: 600 })
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible()

        await page.setViewportSize({ width: 375, height: 667 })
        await expect(page.locator('[data-testid="main-content"]')).toBeVisible()
      })
    })

    test('JavaScript functionality across browsers', async () => {
      await test.step('Event handling works correctly', async () => {
        await page.click('[data-testid="category-balancing-tab"]')

        // Test button clicks
        const simulateButton = page.locator(
          'button:has-text("Simulate Influx")',
        )
        if (await simulateButton.isVisible()) {
          await simulateButton.click()
          // Should not cause JavaScript errors
        }

        // Test real-time mode toggle
        const realTimeButton = page.locator('button:has-text("Inactive")')
        if (await realTimeButton.isVisible()) {
          await realTimeButton.click()
          await expect(page.locator('text=Active')).toBeVisible()
        }
      })

      await test.step('Async operations work correctly', async () => {
        await page.click('[data-testid="export-tab"]')

        // Test export functionality
        await page.click('[data-testid="format-json"]')
        await page.click('button:has-text("Export Selected")')

        // Should show processing status
        await expect(page.locator('text=Export Jobs Status')).toBeVisible()
        await expect(page.locator('text=PROCESSING')).toBeVisible()
      })

      await test.step('Error handling works correctly', async () => {
        // Test with invalid input
        await page.click('[data-testid="data-ingestion-tab"]')

        const fileInput = page.locator('[data-testid="file-input"]')
        await fileInput.setInputFiles([
          {
            name: 'invalid.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('invalid content'),
          },
        ])

        // Should handle gracefully without breaking the page
        // (Specific error handling depends on implementation)
      })
    })

    test('Performance across browsers', async () => {
      await test.step('Page load performance', async () => {
        const startTime = Date.now()
        await page.reload()
        await page.waitForLoadState('networkidle')
        const loadTime = Date.now() - startTime

        console.log(`${browserName} page load time: ${loadTime}ms`)

        // Should load within reasonable time (browser-specific tolerances)
        const maxLoadTime = browserName === 'webkit' ? 8000 : 6000 // Safari might be slower
        expect(loadTime).toBeLessThan(maxLoadTime)
      })

      await test.step('Interaction responsiveness', async () => {
        const startTime = Date.now()

        // Perform several interactions
        await page.click('[data-testid="validation-tab"]')
        await page.click('[data-testid="category-balancing-tab"]')
        await page.click('[data-testid="export-tab"]')

        const interactionTime = Date.now() - startTime

        console.log(`${browserName} interaction time: ${interactionTime}ms`)
        expect(interactionTime).toBeLessThan(3000)
      })
    })

    test('Browser-specific features and limitations', async () => {
      await test.step('Local storage and session storage', async () => {
        // Test storage capabilities
        const storageTest = await page.evaluate(() => {
          try {
            localStorage.setItem('test', 'value')
            const retrieved = localStorage.getItem('test')
            localStorage.removeItem('test')
            return retrieved === 'value'
          } catch (_) {
            return false
          }
        })

        expect(storageTest).toBe(true)
      })

      await test.step('Modern JavaScript features', async () => {
        // Test modern JS features support
        const jsFeatures = await page.evaluate(() => {
          return {
            arrow_functions: (() => true)(),
            async_await: typeof (async () => {})().then === 'function',
            promises: typeof Promise !== 'undefined',
            fetch: typeof fetch !== 'undefined',
            const_let: (() => {
              try {
                return true
              } catch (_) {
                return false
              }
            })(),
          }
        })

        // Modern browsers should support these features
        expect(jsFeatures.arrow_functions).toBe(true)
        expect(jsFeatures.promises).toBe(true)

        console.log(`${browserName} JS features:`, jsFeatures)
      })

      await test.step('CSS features support', async () => {
        // Test CSS features support
        const cssFeatures = await page.evaluate(() => {
          const testElement = document.createElement('div')
          document.body.appendChild(testElement)

          const features = {
            flexbox: CSS.supports('display', 'flex'),
            grid: CSS.supports('display', 'grid'),
            custom_properties: CSS.supports('--custom-property', 'value'),
            transforms: CSS.supports('transform', 'translateX(10px)'),
          }

          document.body.removeChild(testElement)
          return features
        })

        console.log(`${browserName} CSS features:`, cssFeatures)

        // Modern browsers should support flexbox
        expect(cssFeatures.flexbox).toBe(true)
      })
    })

    test('Accessibility across browsers', async () => {
      await test.step('Focus management', async () => {
        // Test focus behavior
        await page.keyboard.press('Tab')
        const focusedElement = page.locator(':focus')
        await expect(focusedElement).toBeVisible()

        // Focus should be visible in all browsers
        const focusStyles = await focusedElement.evaluate((el) => {
          const computed = window.getComputedStyle(el)
          return {
            outline: computed.outline,
            outlineWidth: computed.outlineWidth,
          }
        })

        // Should have some form of focus indicator
        const hasFocusIndicator =
          focusStyles.outline !== 'none' || focusStyles.outlineWidth !== '0px'

        expect(hasFocusIndicator).toBe(true)
      })

      await test.step('ARIA support', async () => {
        // Test ARIA attribute support
        const ariaSupport = await page.evaluate(() => {
          const testElement = document.createElement('div')
          testElement.setAttribute('aria-label', 'test')
          testElement.setAttribute('role', 'button')

          return {
            ariaLabel: testElement.getAttribute('aria-label') === 'test',
            role: testElement.getAttribute('role') === 'button',
          }
        })

        expect(ariaSupport.ariaLabel).toBe(true)
        expect(ariaSupport.role).toBe(true)
      })
    })
  })
})

// Test specific browser combinations and edge cases
test.describe('Browser-Specific Edge Cases', () => {
  test('Safari-specific tests', async ({ playwright }) => {
    const browser = await playwright.webkit.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/demo')
    await page.waitForLoadState('networkidle')

    await test.step('Safari file upload behavior', async () => {
      await page.click('[data-testid="data-ingestion-tab"]')

      // Safari has specific file upload behaviors
      const fileInput = page.locator('[data-testid="file-input"]')
      await fileInput.setInputFiles([
        {
          name: 'safari-test.json',
          mimeType: 'application/json',
          buffer: Buffer.from('{"safari": "test"}'),
        },
      ])

      await expect(page.locator('text=safari-test.json')).toBeVisible()
    })

    await test.step('Safari CSS and layout', async () => {
      // Test Safari-specific CSS behaviors
      const elements = page.locator('button, input, textarea')
      const elementCount = await elements.count()

      // Check that elements render properly in Safari
      for (let i = 0; i < Math.min(elementCount, 5); i++) {
        const element = elements.nth(i)
        if (await element.isVisible()) {
          const boundingBox = await element.boundingBox()
          expect(boundingBox?.width).toBeGreaterThan(0)
          expect(boundingBox?.height).toBeGreaterThan(0)
        }
      }
    })

    await browser.close()
  })

  test('Firefox-specific tests', async ({ playwright }) => {
    const browser = await playwright.firefox.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/demo')
    await page.waitForLoadState('networkidle')

    await test.step('Firefox event handling', async () => {
      await page.click('[data-testid="validation-tab"]')

      // Firefox has specific event handling behaviors
      const textArea = page.locator('[placeholder*="Enter psychology content"]')
      await textArea.fill('Firefox-specific test content')

      await expect(page.locator('text=Validation Results')).toBeVisible()
    })

    await test.step('Firefox CSS rendering', async () => {
      // Test Firefox-specific rendering
      const mainContent = page.locator('[data-testid="main-content"]')
      if (await mainContent.isVisible()) {
        const styles = await mainContent.evaluate((el) => {
          const computed = window.getComputedStyle(el)
          return {
            display: computed.display,
            position: computed.position,
          }
        })

        expect(styles.display).toBeTruthy()
      }
    })

    await browser.close()
  })

  test('Chrome/Chromium-specific tests', async ({ playwright }) => {
    const browser = await playwright.chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/demo')
    await page.waitForLoadState('networkidle')

    await test.step('Chrome performance features', async () => {
      // Test Chrome-specific performance APIs
      const performanceSupport = await page.evaluate(() => {
        return {
          performance: typeof performance !== 'undefined',
          memory: typeof (performance as any).memory !== 'undefined',
          navigation: typeof performance.navigation !== 'undefined',
        }
      })

      expect(performanceSupport.performance).toBe(true)
      console.log('Chrome performance features:', performanceSupport)
    })

    await test.step('Chrome DevTools integration', async () => {
      // Test that the page works well with Chrome DevTools
      await page.click('[data-testid="category-balancing-tab"]')

      // Enable real-time mode (CPU intensive)
      await page.click('button:has-text("Inactive")')

      // Should handle DevTools profiling without issues
      const startTime = Date.now()
      await page.click('button:has-text("Simulate Influx")')
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(5000)
    })

    await browser.close()
  })
})

// Test older browser compatibility (if needed)
test.describe('Legacy Browser Support', () => {
  test('Graceful degradation', async ({ page }) => {
    await page.goto('/demo')

    // Test that the page works even with limited JavaScript
    await test.step('Basic functionality without modern features', async () => {
      // Disable some modern features
      await page.addInitScript(() => {
        // Simulate older browser by removing some modern APIs
        delete (window as any).fetch
        delete (window as any).Promise
      })

      await page.reload()
      await page.waitForLoadState('networkidle')

      // Basic navigation should still work
      await expect(page.locator('text=Psychology Pipeline Demo')).toBeVisible()
    })
  })
})

// Test browser-specific device combinations
test.describe('Browser-Device Combinations', () => {
  const deviceBrowserCombinations = [
    { deviceName: 'iPhone 12', device: devices['iPhone 12'], browser: 'webkit' as const },
    { deviceName: 'Pixel 5', device: devices['Pixel 5'], browser: 'chromium' as const },
    { deviceName: 'iPad Pro', device: devices['iPad Pro'], browser: 'webkit' as const },
  ]

  deviceBrowserCombinations.forEach(({ deviceName, device, browser }) => {
    test(`${deviceName} with ${browser}`, async ({ playwright }) => {
      const browserInstance = await playwright[browser].launch()
      const context = await browserInstance.newContext({
        ...device,
      })
      const page = await context.newPage()

      await page.goto('/demo')
      await page.waitForLoadState('networkidle')

      // Test basic functionality on device-browser combination
      await expect(page.locator('text=Psychology Pipeline Demo')).toBeVisible()

      // Test touch interactions
      await page.click('[data-testid="validation-tab"]')
      await expect(
        page.locator('[data-testid="validation-section"]'),
      ).toBeVisible()

      await browserInstance.close()
    })
  })
})
