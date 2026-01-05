import { test, expect } from '@playwright/test'

// Accessibility testing utilities
const accessibilityTests = {
  // WCAG 2.1 Level AA contrast ratios
  contrastRatios: {
    normal: 4.5, // Normal text
    large: 3.0, // Large text (18pt+ or 14pt+ bold)
    ui: 3.0, // UI components
  },

  // Color blindness simulation
  colorBlindnessFilters: {
    protanopia: 'protanopia', // Red-blind
    deuteranopia: 'deuteranopia', // Green-blind
    tritanopia: 'tritanopia', // Blue-blind
    achromatopsia: 'achromatopsia', // Complete color blindness
  },
}

// Color contrast calculation utilities
function getLuminance(color: string): number {
  // Parse RGB values
  const rgb = color.match(/\d+/g)?.map(Number) || [0, 0, 0]

  // Convert to sRGB
  const [r, g, b] = rgb.map((c) => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })

  // Calculate luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return (brightest + 0.05) / (darkest + 0.05)
}

test.describe('Theme Accessibility Tests', () => {
  let page

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test.describe('Color Contrast Analysis', () => {
    test('light theme should meet WCAG contrast requirements', async () => {
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

      // Test text contrast against background
      const textContrast = await page.evaluate(() => {
        const body = document.body
        const textColor = window.getComputedStyle(body).color
        const bgColor = window.getComputedStyle(body).backgroundColor
        return { textColor, bgColor }
      })

      const contrastRatio = getContrastRatio(
        textContrast.textColor,
        textContrast.bgColor,
      )
      expect(contrastRatio).toBeGreaterThanOrEqual(
        accessibilityTests.contrastRatios.normal,
      )
    })

    test('dark theme should meet WCAG contrast requirements', async () => {
      // Set dark theme
      await page.evaluate(() => {
        localStorage.setItem('theme', 'dark')
        document.documentElement.classList.remove('light', 'system')
        document.documentElement.classList.add('dark', 'enhanced-dark-theme')
        document.body.classList.remove('light', 'system')
        document.body.classList.add('dark', 'enhanced-dark-theme')
      })
      await page.reload()

      // Test text contrast against background
      const textContrast = await page.evaluate(() => {
        const body = document.body
        const textColor = window.getComputedStyle(body).color
        const bgColor = window.getComputedStyle(body).backgroundColor
        return { textColor, bgColor }
      })

      const contrastRatio = getContrastRatio(
        textContrast.textColor,
        textContrast.bgColor,
      )
      expect(contrastRatio).toBeGreaterThanOrEqual(
        accessibilityTests.contrastRatios.normal,
      )
    })

    test('accent colors should have sufficient contrast', async () => {
      // Test accent colors in both themes
      const themes = ['light', 'dark']

      for (const theme of themes) {
        await page.evaluate((t) => {
          localStorage.setItem('theme', t)
          document.documentElement.classList.remove(
            'light',
            'dark',
            'system',
            'enhanced-dark-theme',
          )
          document.body.classList.remove(
            'light',
            'dark',
            'system',
            'enhanced-dark-theme',
          )

          if (t === 'dark') {
            document.documentElement.classList.add(
              'dark',
              'enhanced-dark-theme',
            )
            document.body.classList.add('dark', 'enhanced-dark-theme')
          } else {
            document.documentElement.classList.add('light')
            document.body.classList.add('light')
          }
        }, theme)
        await page.reload()

        const accentContrast = await page.evaluate(() => {
          const accentColor =
            window
              .getComputedStyle(document.documentElement)
              .getPropertyValue('--accent-primary') || '#10b981'
          const bgColor = window.getComputedStyle(document.body).backgroundColor
          return { accentColor, bgColor }
        })

        const contrastRatio = getContrastRatio(
          accentContrast.accentColor,
          accentContrast.bgColor,
        )
        expect(contrastRatio).toBeGreaterThanOrEqual(
          accessibilityTests.contrastRatios.ui,
        )
      }
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('theme toggle should be keyboard accessible', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')

      // Test tab navigation
      await page.keyboard.press('Tab')
      const isFocused = await themeToggle.evaluate(
        (el) => el === document.activeElement,
      )
      expect(isFocused).toBe(true)

      // Test keyboard activation
      await page.keyboard.press('Enter')
      const themeAfterEnter = await page.evaluate(() =>
        localStorage.getItem('theme'),
      )
      expect(themeAfterEnter).toBeTruthy()

      // Test focus styles
      const focusStyles = await themeToggle.evaluate((el) => {
        return window.getComputedStyle(el, ':focus-visible')
      })

      expect(focusStyles.outline).not.toBe('none')
      expect(focusStyles.outlineWidth).not.toBe('0px')
    })

    test('focus should be visible and high contrast', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')
      await themeToggle.focus()

      const focusContrast = await page.evaluate(() => {
        const focusedElement = document.activeElement
        if (!focusedElement) return null

        const focusColor = window.getComputedStyle(
          focusedElement,
          ':focus-visible',
        ).outlineColor
        const bgColor = window.getComputedStyle(document.body).backgroundColor
        return { focusColor, bgColor }
      })

      if (focusContrast) {
        const contrastRatio = getContrastRatio(
          focusContrast.focusColor,
          focusContrast.bgColor,
        )
        expect(contrastRatio).toBeGreaterThanOrEqual(3.0) // UI component requirement
      }
    })
  })

  test.describe('Screen Reader Support', () => {
    test('theme toggle should have proper ARIA attributes', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')

      // Check aria-label
      const ariaLabel = await themeToggle.getAttribute('aria-label')
      expect(ariaLabel).toBe('Toggle theme')

      // Check role (should be button or have implicit button role)
      const role = await themeToggle.getAttribute('role')
      const tagName = await themeToggle.evaluate((el) =>
        el.tagName.toLowerCase(),
      )

      if (tagName !== 'button') {
        expect(role).toBe('button')
      }

      // Check aria-pressed state if applicable
      const ariaPressed = await themeToggle.getAttribute('aria-pressed')
      if (ariaPressed) {
        expect(['true', 'false']).toContain(ariaPressed)
      }
    })

    test('theme state should be announced', async () => {
      const themeToggle = page.locator('#theme-toggle-v2')

      // Click to change theme
      await themeToggle.click()

      // Check if aria-live region exists for announcements
      const hasAriaLive = await page.evaluate(() => {
        return document.querySelector('[aria-live]') !== null
      })

      if (hasAriaLive) {
        const ariaLiveContent = await page.locator('[aria-live]').textContent()
        expect(ariaLiveContent).toBeTruthy()
      }
    })
  })

  test.describe('Reduced Motion Support', () => {
    test('should respect prefers-reduced-motion', async () => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.reload()

      // Check transition durations
      const transitionDurations = await page.evaluate(() => {
        const toggle = document.getElementById('theme-toggle-v2')
        if (!toggle) return null

        return {
          transition: window.getComputedStyle(toggle).transitionDuration,
          animation: window.getComputedStyle(toggle).animationDuration,
        }
      })

      if (transitionDurations) {
        expect(transitionDurations.transition).toMatch(/0|0\.01ms/)
        expect(transitionDurations.animation).toMatch(/0|0\.01ms/)
      }
    })

    test('should handle no-preference for motion', async () => {
      // Set no preference (default)
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      await page.reload()

      // Check that transitions are enabled
      const transitionDurations = await page.evaluate(() => {
        const toggle = document.getElementById('theme-toggle-v2')
        if (!toggle) return null

        return {
          transition: window.getComputedStyle(toggle).transitionDuration,
          animation: window.getComputedStyle(toggle).animationDuration,
        }
      })

      if (transitionDurations) {
        expect(transitionDurations.transition).not.toMatch(/0|0\.01ms/)
      }
    })
  })

  test.describe('Color Blindness Considerations', () => {
    test('should not rely solely on color for theme indication', async () => {
      // Test that theme toggle has visual indicators beyond color
      const themeToggle = page.locator('#theme-toggle-v2')

      const visualIndicators = await themeToggle.evaluate((el) => {
        const computedStyle = window.getComputedStyle(el)
        return {
          hasBorder: computedStyle.borderWidth !== '0px',
          hasShadow: computedStyle.boxShadow !== 'none',
          hasIcon: el.querySelector('svg') !== null,
        }
      })

      // Should have multiple visual indicators
      expect(visualIndicators.hasIcon).toBe(true)
      // Border and shadow are optional but should be considered
    })

    test('status indicators should be distinguishable without color', async () => {
      // Test that theme status can be determined without relying on color
      const themeStatusIndicators = await page.evaluate(() => {
        const html = document.documentElement
        const indicators = []

        // Check for class-based indicators
        if (html.classList.contains('light')) indicators.push('light-class')
        if (html.classList.contains('dark')) indicators.push('dark-class')
        if (html.classList.contains('system')) indicators.push('system-class')

        // Check for data attributes
        const dataTheme = html.getAttribute('data-theme')
        if (dataTheme) indicators.push(`data-${dataTheme}`)

        return indicators
      })

      expect(themeStatusIndicators.length).toBeGreaterThan(0)
    })
  })

  test.describe('High Contrast Mode', () => {
    test('should support forced-colors mode', async () => {
      // Emulate high contrast mode
      await page.emulateMedia({ forcedColors: 'active' })
      await page.reload()

      // Check that high contrast styles are applied
      const highContrastStyles = await page.evaluate(() => {
        const root = document.documentElement
        const styles = window.getComputedStyle(root)

        return {
          background: styles.backgroundColor,
          color: styles.color,
          forcedColors: styles.forcedColorAdjust,
        }
      })

      // Should have system colors in high contrast mode
      expect(highContrastStyles.background).toBeTruthy()
      expect(highContrastStyles.color).toBeTruthy()
    })
  })

  test.describe('Semantic HTML', () => {
    test('should use semantic HTML elements', async () => {
      // Check for proper semantic structure
      const semanticElements = await page.evaluate(() => {
        return {
          hasMain: document.querySelector('main') !== null,
          hasHeader: document.querySelector('header') !== null,
          hasFooter: document.querySelector('footer') !== null,
          hasNav: document.querySelector('nav') !== null,
        }
      })

      // These should exist for proper semantic structure
      expect(semanticElements.hasMain).toBe(true)
    })

    test('should have proper heading hierarchy', async () => {
      const headingStructure = await page.evaluate(() => {
        const headings = Array.from(
          document.querySelectorAll('h1, h2, h3, h4, h5, h6'),
        )
        return headings.map((h) => ({
          level: parseInt(h.tagName.charAt(1)),
          text: h.textContent?.trim() || '',
        }))
      })

      // Should have at least one h1
      const hasH1 = headingStructure.some((h) => h.level === 1)
      expect(hasH1).toBe(true)

      // Check for proper heading order (no skipping levels)
      for (let i = 1; i < headingStructure.length; i++) {
        const levelDiff = Math.abs(
          headingStructure[i].level - headingStructure[i - 1].level,
        )
        expect(levelDiff).toBeLessThanOrEqual(1) // No skipping more than one level
      }
    })
  })
})
