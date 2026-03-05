import type { Browser, BrowserContext, Page } from '@playwright/test'
import { devices, expect, test } from '@playwright/test'

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
      await page.goto('/')
      await page.waitForLoadState('networkidle')
    })

    test('Basic page functionality works across browsers', async () => {
      await test.step('Page loads and renders correctly', async () => {
        // Check that main elements are visible
        await expect(page.locator('h1')).toBeVisible()
        await expect(page.locator('nav')).toBeVisible()
        await expect(page.locator('footer')).toBeVisible()
      })

      await test.step('Navigation between tabs works', async () => {
        // Test tab navigation
        await page.click('a[href="/blog"]')
        await expect(page).toHaveURL('/blog')

        await page.click('a[href="/docs"]')
        await expect(page).toHaveURL('/docs/getting-started')

        await page.click('a[href="/"]')
        await expect(page).toHaveURL('/')
      })

      await test.step('Interactive elements respond correctly', async () => {
        // Test buttons
        const buttons = page.locator('button')
        const buttonCount = await buttons.count()
        expect(buttonCount).toBeGreaterThan(0)

        // Test first few buttons
        const limit = Math.min(buttonCount, 5)
        for (let i = 0; i < limit; i++) {
          const button = buttons.nth(i)
          if (await button.isVisible() && await button.isEnabled()) {
            await button.hover()
            // Button should be hoverable without errors
          }
        }
      })
    })

    test('File upload functionality across browsers', async () => {
      await test.step('File input works correctly', async () => {
        await page.goto('/contact')
        const fileInput = page.locator('input[type="file"]')
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
    })

    test('Form inputs and validation across browsers', async () => {
      await test.step('Text input and validation', async () => {
        await page.goto('/contact')

        const textArea = page.locator('textarea[name="message"]')
        await expect(textArea).toBeVisible()

        // Test text input
        await textArea.fill('Test content for cross-browser validation')

        await page.click('button[type="submit"]')

        // Should show validation results
        await expect(page.locator('text=Message sent')).toBeVisible({
          timeout: 5000,
        })
      })
    })

    test('CSS and styling consistency across browsers', async () => {
      await test.step('Layout and positioning', async () => {
        // Check that key elements are positioned correctly
        const mainContent = page.locator('main')
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
        await expect(page.locator('main')).toBeVisible()

        await page.setViewportSize({ width: 768, height: 600 })
        await expect(page.locator('main')).toBeVisible()

        await page.setViewportSize({ width: 375, height: 667 })
        await expect(page.locator('main')).toBeVisible()
      })
    })

    test('JavaScript functionality across browsers', async () => {
      await test.step('Event handling works correctly', async () => {
        // Test button clicks
        const button = page.locator('button').first()
        if (await button.isVisible()) {
          await button.click()
          // Should not cause JavaScript errors
        }
      })

      await test.step('Async operations work correctly', async () => {
        await page.goto('/blog')
        // Should show processing status
        await expect(page.locator('h1')).toBeVisible()
      })
    })

    test('Performance across browsers', async () => {
      await test.step('Page load performance', async () => {
        const startTime = performance.now()
        await page.reload()
        await page.waitForLoadState('networkidle')
        const loadTime = performance.now() - startTime

        console.log(`${browserName} page load time: ${loadTime}ms`)

        // Should load within reasonable time (browser-specific tolerances)
        const maxLoadTime = ({ webkit: 8000 } as const)[browserName] ?? 6000 // Safari might be slower
        expect(loadTime).toBeLessThan(maxLoadTime)
      })

      await test.step('Interaction responsiveness', async () => {
        const startTime = performance.now()

        // Perform several interactions
        await page.click('a[href="/blog"]')
        await page.click('a[href="/docs"]')
        await page.click('a[href="/"]')

        const interactionTime = performance.now() - startTime

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
            return Object.is(retrieved, 'value')
          } catch (_err) {
            return false
          }
        })

        expect(storageTest).toBe(true)
      })

      await test.step('Modern JavaScript features', async () => {
        // Test modern JS features support
        const jsFeatures = await page.evaluate(() => {
          return {
            arrow_functions: true,
            async_await: !!(async () => { }),
            promises: 'Promise' in globalThis,
            fetch: 'fetch' in globalThis,
            const_let: (() => {
              try {
                return true
              } catch (_err) {
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
        const noneOrZero = (v: string) => v === 'none' || v === '0px'
        const hasFocusIndicator = !(noneOrZero(focusStyles.outline) && noneOrZero(focusStyles.outlineWidth))

        expect(hasFocusIndicator).toBe(true)
      })

      await test.step('ARIA support', async () => {
        // Test ARIA attribute support
        const ariaSupport = await page.evaluate(() => {
          const testElement = document.createElement('div')
          testElement.setAttribute('aria-label', 'test')
          testElement.setAttribute('role', 'button')

          return {
            ariaLabel: testElement.matches('[aria-label="test"]'),
            role: testElement.matches('[role="button"]'),
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

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await test.step('Safari file upload behavior', async () => {
      await page.goto('/contact')

      // Safari has specific file upload behaviors
      const fileInput = page.locator('input[type="file"]')
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
      const limit = Math.min(elementCount, 5)
      for (let i = 0; i < limit; i++) {
        const element = elements.nth(i)
        if (await element.isVisible()) {
          const boundingBox = await element.boundingBox()
          expect((boundingBox?.width ?? 0) > 0).toBe(true)
          expect((boundingBox?.height ?? 0) > 0).toBe(true)
        }
      }
    })

    await browser.close()
  })

  test('Firefox-specific tests', async ({ playwright }) => {
    const browser = await playwright.firefox.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await test.step('Firefox event handling', async () => {
      await page.goto('/contact')

      // Firefox has specific event handling behaviors
      const textArea = page.locator('textarea[name="message"]')
      await textArea.fill('Firefox-specific test content')

      await page.click('button[type="submit"]')

      await expect(page.locator('text=Message sent')).toBeVisible()
    })

    await test.step('Firefox CSS rendering', async () => {
      // Test Firefox-specific rendering
      const mainContent = page.locator('main')
      if (await mainContent.isVisible()) {
        const styles = await mainContent.evaluate((el) => {
          const computed = window.getComputedStyle(el)
          return {
            display: computed.display,
            position: computed.position,
          }
        })

        expect(Boolean(styles.display)).toBe(true)
      }
    })

    await browser.close()
  })

  test('Chrome/Chromium-specific tests', async ({ playwright }) => {
    const browser = await playwright.chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await test.step('Chrome performance features', async () => {
      // Test Chrome-specific performance APIs
      const performanceSupport = await page.evaluate(() => {
        return {
          performance: !!performance,
          memory: !!(performance as any).memory,
          navigation: !!performance.navigation,
        }
      })

      expect(performanceSupport.performance).toBe(true)
      console.log('Chrome performance features:', performanceSupport)
    })

    await browser.close()
  })
})

// Test older browser compatibility (if needed)
test.describe('Legacy Browser Support', () => {
  test('Graceful degradation', async ({ page }) => {
    await page.goto('/')

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
      await expect(page.locator('h1')).toBeVisible()
    })
  })
})

// Test browser-specific device combinations
test.describe('Browser-Device Combinations', () => {
  const deviceBrowserCombinations = [
    {
      deviceName: 'iPhone 12',
      device: devices['iPhone 12'],
      browser: 'webkit' as const,
    },
    {
      deviceName: 'Pixel 5',
      device: devices['Pixel 5'],
      browser: 'chromium' as const,
    },
    {
      deviceName: 'iPad Pro',
      device: devices['iPad Pro'],
      browser: 'webkit' as const,
    },
  ]

  deviceBrowserCombinations.forEach(({ deviceName, device, browser }) => {
    test(`${deviceName} with ${browser}`, async ({ playwright }) => {
      const browserInstance = await playwright[browser].launch()
      const context = await browserInstance.newContext({
        ...device,
      })
      const page = await context.newPage()

      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Test basic functionality on device-browser combination
      await expect(page.locator('h1')).toBeVisible()

      // Test touch interactions
      await page.click('a[href="/blog"]')
      await expect(page).toHaveURL('/blog')

      await browserInstance.close()
    })
  })
})
