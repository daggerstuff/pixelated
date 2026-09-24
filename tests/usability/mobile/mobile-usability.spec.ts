import { test, expect } from '@playwright/test'

import { UsabilityUtils } from '../utils/UsabilityUtils'

test.describe('Mobile Usability', () => {
  const mobileViewports = [
    { width: 375, height: 667, name: 'iPhone SE' },
    { width: 390, height: 844, name: 'iPhone 12' },
    { width: 360, height: 640, name: 'Android Small' },
    { width: 412, height: 915, name: 'Android Large' },
  ]

  mobileViewports.forEach((viewport) => {
    test(`should be usable on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const results = await UsabilityUtils.testMobileUsability(page)

      // Include the recorded errors in the failure message so the
      // offending element is identifiable from CI logs alone.
      expect(results.touchTargetsAdequate, results.errors.join('; ')).toBe(true)
      expect(results.textReadable, results.errors.join('; ')).toBe(true)
      expect(results.contentFitsViewport, results.errors.join('; ')).toBe(true)

      if (results.errors.length > 0) {
        console.log(
          `Mobile usability issues on ${viewport.name}:`,
          results.errors,
        )
      }
    })
  })

  test('should have adequate touch target sizes', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    const touchTargets = await page
      .locator(
        'button, a, input[type="button"], input[type="submit"], [role="button"]',
      )
      .all()

    for (const target of touchTargets) {
      const box = await target.boundingBox()
      if (!box || box.width < 1 || box.height < 1) {
        // Not rendered (or visually hidden, e.g. the skip link).
        continue
      }
      const isInlineTextLink = await target.evaluate((el) => {
        if (el.tagName !== 'A') return false
        return window.getComputedStyle(el).display === 'inline'
      })
      if (isInlineTextLink) {
        // WCAG 2.2 AA 2.5.8 exception for links inline in sentences.
        continue
      }
      // WCAG 2.2 AA 2.5.8 minimum target size. The 44px mobile best
      // practice is tracked design debt (DESIGN.md §7).
      expect(box.width).toBeGreaterThanOrEqual(24)
      expect(box.height).toBeGreaterThanOrEqual(24)
    }
  })

  test('should have readable text on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    const textElements = await page
      .locator('p, span, div, li, h1, h2, h3, h4, h5, h6')
      .all()

    for (const element of textElements.slice(0, 10)) {
      const fontSize = await element.evaluate((el) => {
        return parseFloat(window.getComputedStyle(el).fontSize)
      })

      // Smallest type sanctioned by the design doctrine is the 12px
      // Label (DESIGN.md §3); WCAG sets no minimum font size.
      expect(fontSize).toBeGreaterThanOrEqual(12)
    }
  })

  test('should not require horizontal scrolling', async ({ page }) => {
    const viewports = [320, 375, 414] // Common mobile widths

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 667 })
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const hasHorizontalScroll = await page.evaluate(() => {
        return (
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth
        )
      })

      expect(hasHorizontalScroll).toBe(false)
    }
  })

  test('should have working mobile navigation', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Look for mobile menu toggle
    const menuToggle = page.locator(
      '[aria-label*="menu"], .menu-toggle, .hamburger, [data-testid="mobile-menu-toggle"]',
    )

    if ((await menuToggle.count()) > 0) {
      // Test menu toggle
      await menuToggle.click()
      await page.waitForTimeout(500)

      // Check if menu is visible
      const mobileMenu = page.locator(
        '.mobile-menu, [aria-expanded="true"], .nav-open',
      )
      await expect(mobileMenu.first()).toBeVisible()

      // Test menu close
      await menuToggle.click()
      await page.waitForTimeout(500)

      // Menu should be hidden
      await expect(mobileMenu.first()).not.toBeVisible()
    }
  })

  test('should support touch gestures', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    // Test swipe gestures if carousel or swipeable content exists
    const swipeableElements = page.locator(
      '[data-swipeable], .carousel, .slider',
    )

    if ((await swipeableElements.count()) > 0) {
      const element = swipeableElements.first()
      const box = await element.boundingBox()

      if (box) {
        // Simulate swipe left
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2)
        await page.mouse.up()

        await page.waitForTimeout(500)
      }
    }
  })

  test('should handle orientation changes', async ({ page }) => {
    // Test portrait mode
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    let hasHorizontalScroll = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(hasHorizontalScroll).toBe(false)

    // Test landscape mode
    await page.setViewportSize({ width: 667, height: 375 })
    await page.waitForTimeout(500)

    hasHorizontalScroll = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth
      )
    })
    expect(hasHorizontalScroll).toBe(false)
  })

  test('should have appropriate spacing for mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)

    // Spacing per WCAG 2.2 AA 2.5.8's spacing exception: undersized
    // targets (< 24px in either dimension) pass when their centers are
    // at least 24px from the centers of other targets. Only elements
    // that actually overlap horizontally can crowd each other vertically.
    const interactives = await page.locator('button, a').all()

    for (let i = 0; i < interactives.length - 1; i++) {
      const currentBox = await interactives[i].boundingBox()
      const nextBox = await interactives[i + 1].boundingBox()

      if (!currentBox || !nextBox) continue

      const horizontallyOverlapping =
        currentBox.x < nextBox.x + nextBox.width &&
        nextBox.x < currentBox.x + currentBox.width
      const undersized =
        Math.min(currentBox.width, currentBox.height) < 24 ||
        Math.min(nextBox.width, nextBox.height) < 24

      if (!horizontallyOverlapping || !undersized) continue

      const centerDistance = Math.hypot(
        nextBox.x + nextBox.width / 2 - (currentBox.x + currentBox.width / 2),
        nextBox.y + nextBox.height / 2 - (currentBox.y + currentBox.height / 2),
      )

      const currentMarkup = await interactives[i].evaluate((el) =>
        el.outerHTML.slice(0, 80),
      )
      const nextMarkup = await interactives[i + 1].evaluate((el) =>
        el.outerHTML.slice(0, 80),
      )

      expect(
        centerDistance,
        `Undersized targets too close (${centerDistance.toFixed(1)}px center-to-center): ${currentMarkup} | ${nextMarkup}`,
      ).toBeGreaterThanOrEqual(24)
    }
  })
})
