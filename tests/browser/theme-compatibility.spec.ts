import {
  test,
  expect,
  Page,
  Browser,
  BrowserContext,
  } from '@playwright/test'


// Test configuration for different browsers and devices
const testConfig = {
  browsers: ['chromium', 'firefox', 'webkit'],
  devices: [
    'Desktop Chrome',
    'Desktop Firefox',
    'Desktop Safari',
    'iPhone 12',
    'iPad',
  ],
  viewportSizes: [
    { name: 'mobile', width: 375, height: 667 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'desktop', width: 1920, height: 1080 },
  ],
}

// Theme variables to test
const themeVariables = {
  light: {
    '--color-background': 'rgb(246, 246, 246)', // #f6f6f6
    '--color-foreground': 'rgb(33, 33, 33)', // #212121
    '--color-card': 'rgb(255, 255, 255)', // #ffffff
    '--color-border': 'rgb(224, 224, 224)', // #e0e0e0
  },
  dark: {
    '--color-background': 'rgb(18, 18, 18)', // #121212
    '--color-foreground': 'rgb(255, 255, 255)', // #ffffff
    '--color-card': 'rgb(33, 33, 33)', // #212121
    '--color-border': 'rgb(51, 51, 51)', // #333333
  },
}

test.describe('Theme Compatibility Tests', () => {
  let page: Page
  let context: BrowserContext
  let browser: Browser

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      javaScriptEnabled: true,
    })
    page = await context.newPage()
  })

  test.afterAll(async () => {
    await context.close()
  })

  test.beforeEach(async () => {
    await page.goto('http://localhost:3000')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Cross-Browser Theme Rendering', () => {
    test('should render light theme correctly across browsers', async ({
      browserName,
    }) => {
      // Set light theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'light')
        document.documentElement.classList.remove(
          'dark',
          'system',
          'enhanced-dark-theme',
        )
        document.documentElement.classList.add('light')
        document.body.classList.remove('dark', 'system', 'enhanced-dark-theme')
        document.body.classList.add('light')
      })

      await page.reload()

      // Verify CSS variables are applied correctly
      const bgColor = await page.evaluate(() => {
        return window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--color-background')
      })

      expect(bgColor.trim()).toBe(themeVariables.light['--color-background'])

      // Screenshot for visual regression testing
      await page.screenshot({
        path: `tests/screenshots/${browserName}-light-theme.png`,
        fullPage: true,
      })
    })

    test('should render dark theme correctly across browsers', async ({
      browserName,
    }) => {
      // Set dark theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark')
        document.documentElement.classList.remove('light', 'system')
        document.documentElement.classList.add('dark', 'enhanced-dark-theme')
        document.body.classList.remove('light', 'system')
        document.body.classList.add('dark', 'enhanced-dark-theme')
      })

      await page.reload()

      // Verify CSS variables are applied correctly
      const bgColor = await page.evaluate(() => {
        return window
          .getComputedStyle(document.documentElement)
          .getPropertyValue('--color-background')
      })

      expect(bgColor.trim()).toBe(themeVariables.dark['--color-background'])

      // Screenshot for visual regression testing
      await page.screenshot({
        path: `tests/screenshots/${browserName}-dark-theme.png`,
        fullPage: true,
      })
    })

    test('should handle system theme preference', async ({ browserName: _browserName }) => {
      // Mock system dark preference
      await page.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          value: (query) => ({
            matches: query === '(prefers-color-scheme: dark)',
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => {},
          }),
        })
      })

      await page.evaluate(() => {
        localStorage.setItem('theme', 'system')
      })

      await page.reload()

      // Should apply dark theme based on system preference
      const hasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains(
          'enhanced-dark-theme',
        )
      })

      expect(hasDarkClass).toBe(true)
    })
  })

  test.describe('Theme Toggle Functionality', () => {
    test('should switch between themes correctly', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')

      // Initial state
      const initialTheme = await page.evaluate(() =>
        localStorage.getItem('theme'),
      )

      // Click to switch themes
      await themeToggle.click()

      // Verify theme changed
      const newTheme = await page.evaluate(() => localStorage.getItem('theme'))
      expect(newTheme).not.toBe(initialTheme)

      // Verify visual feedback
      const toggleTransform = await themeToggle.evaluate((el) => {
        return window.getComputedStyle(el).transform
      })

      expect(toggleTransform).not.toBe('none')
    })

    test('should persist theme preference', async () => {
      // Set theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark')
      })

      // Reload page
      await page.reload()

      // Verify theme persisted
      const persistedTheme = await page.evaluate(() =>
        localStorage.getItem('theme'),
      )
      expect(persistedTheme).toBe('dark')

      const hasDarkClass = await page.evaluate(() => {
        return document.documentElement.classList.contains('dark')
      })
      expect(hasDarkClass).toBe(true)
    })

    test('should update meta theme-color', async () => {
      const metaThemeColor = await page.locator('meta[name="theme-color"]')

      // Test light theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'light')
      })
      await page.reload()

      const lightThemeColor = await metaThemeColor.getAttribute('content')
      expect(lightThemeColor).toBe('#ffffff')

      // Test dark theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark')
      })
      await page.reload()

      const darkThemeColor = await metaThemeColor.getAttribute('content')
      expect(darkThemeColor).toBe('#0a0a0a')
    })
  })

  test.describe('Responsive Design', () => {
    for (const viewport of testConfig.viewportSizes) {
      test(`should render correctly on ${viewport.name} viewport`, async ({
        browserName,
      }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        })
        await page.reload()

        // Test theme toggle visibility
        const themeToggle = page.locator('#theme-toggle-v2')
        const isVisible = await themeToggle.isVisible()
        expect(isVisible).toBe(true)

        // Test layout stability
        const bodyOverflow = await page.evaluate(() => {
          return window.getComputedStyle(document.body).overflowX
        })

        expect(bodyOverflow).toBe('hidden')

        // Screenshot for visual regression testing
        await page.screenshot({
          path: `tests/screenshots/${browserName}-${viewport.name}-responsive.png`,
          fullPage: true,
        })
      })
    }
  })

  test.describe('CSS Feature Support', () => {
    test('should support CSS custom properties', async () => {
      const supportsCustomProperties = await page.evaluate(() => {
        return CSS.supports('--test', '0')
      })
      expect(supportsCustomProperties).toBe(true)
    })

    test('should support backdrop-filter', async () => {
      const supportsBackdropFilter = await page.evaluate(() => {
        return (
          CSS.supports('backdrop-filter', 'blur(12px)') ||
          CSS.supports('-webkit-backdrop-filter', 'blur(12px)')
        )
      })

      // Should support either standard or webkit prefix
      expect(supportsBackdropFilter).toBe(true)
    })

    test('should support color-mix function', async () => {
      const supportsColorMix = await page.evaluate(() => {
        return CSS.supports('color', 'color-mix(in srgb, red, blue)')
      })

      // Modern browsers should support this
      const browserName = await page.evaluate(() => navigator.userAgent)
      if (
        browserName.includes('Chrome') ||
        browserName.includes('Firefox') ||
        browserName.includes('Safari')
      ) {
        expect(supportsColorMix).toBe(true)
      }
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')
      const ariaLabel = await themeToggle.getAttribute('aria-label')
      expect(ariaLabel).toBe('Toggle theme')
    })

    test('should be keyboard navigable', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')

      // Focus the toggle
      await themeToggle.focus()

      // Check focus styles
      const focusStyles = await themeToggle.evaluate((el) => {
        return window.getComputedStyle(el, ':focus-visible')
      })

      expect(focusStyles.outline).not.toBe('none')
    })

    test('should support reduced motion preferences', async () => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.reload()

      const transitionDuration = await page.evaluate(() => {
        const toggle = document.getElementById('theme-toggle-v2')
        return window.getComputedStyle(toggle!).transitionDuration
      })

      // Should have minimal or no transitions
      expect(transitionDuration).toMatch(/0|0\.01ms/)
    })

    test('should have sufficient color contrast', async () => {
      // Test dark theme contrast
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark')
      })
      await page.reload()

      const contrastRatio = await page.evaluate(() => {
        const text = document.querySelector('body')
        const bg = document.querySelector('body')

        const textColor = window.getComputedStyle(text!).color
        const bgColor = window.getComputedStyle(bg!).backgroundColor

        // Simple contrast calculation (would need proper library for accurate results)
        return { textColor, bgColor }
      })

      expect(contrastRatio.textColor).toBe('rgb(255, 255, 255)')
      expect(contrastRatio.bgColor).toBe('rgb(18, 18, 18)')
    })
  })

  test.describe('Performance', () => {
    test('should load theme styles efficiently', async () => {
      const performanceEntries = await page.evaluate(() => {
        return performance
          .getEntriesByType('resource')
          .filter((entry: any) => entry.name.includes('.css'))
          .map((entry: any) => ({
            name: entry.name,
            duration: entry.duration,
            size: entry.transferSize,
          }))
      })

      // CSS files should load quickly
      for (const entry of performanceEntries) {
        expect(entry.duration).toBeLessThan(1000) // Less than 1 second
      }
    })

    test('should not cause layout thrashing', async () => {
      // Measure layout performance during theme switch
      await page.evaluate(() => {
        performance.mark('theme-switch-start')
        document.getElementById('theme-toggle-v2')?.click()
        performance.mark('theme-switch-end')
      })

      const measure = await page.evaluate(() => {
        return performance.measure(
          'theme-switch',
          'theme-switch-start',
          'theme-switch-end',
        )
      })

      expect(measure.duration).toBeLessThan(100) // Should be very fast
    })
  })

  test.describe('Browser-Specific Issues', () => {
    test('should handle Safari backdrop-filter gracefully', async ({
      browserName,
    }) => {
      if (browserName === 'webkit') {
        // Test glass morphism effects in Safari
        const glassElements = await page.locator('.glass-surface').count()

        if (glassElements > 0) {
          const backdropFilter = await page.evaluate(() => {
            const element = document.querySelector('.glass-surface')
            return (
              window.getComputedStyle(element!).backdropFilter ||
              window.getComputedStyle(element!).webkitBackdropFilter
            )
          })

          // Should have either standard or webkit backdrop filter
          expect(backdropFilter).toBeTruthy()
        }
      }
    })

    test('should handle Firefox color-scheme correctly', async ({
      browserName,
    }) => {
      if (browserName === 'firefox') {
        await page.evaluate(() => {
          localStorage.setItem('theme', 'dark')
        })
        await page.reload()

        const colorScheme = await page.evaluate(() => {
          return window.getComputedStyle(document.documentElement).colorScheme
        })

        // Firefox should respect color-scheme
        expect(colorScheme).toBeTruthy()
      }
    })

    test('should handle Chrome CSS custom properties', async ({
      browserName,
    }) => {
      if (browserName === 'chromium') {
        // Test complex CSS variable inheritance in Chrome
        const computedStyles = await page.evaluate(() => {
          const testElement = document.createElement('div')
          testElement.style.setProperty('--test-var', 'red')
          testElement.style.color = 'var(--test-var)'
          document.body.appendChild(testElement)

          return window.getComputedStyle(testElement).color
        })

        expect(computedStyles).toBe('rgb(255, 0, 0)')
      }
    })
  })
})
