/**
 * Comprehensive Responsive Design and Navigation Test
 * Tests the final tasks from Phase 7: Testing and Optimization
 */

import { test, expect } from '@playwright/test'

test.describe('Responsive Design and Navigation Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
  })

  test('should display correctly on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })

    // Check header is visible and properly positioned
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Check navigation is visible on desktop
    const desktopNav = page.locator('nav ul').first()
    await expect(desktopNav).toBeVisible()

    // Check hamburger menu is hidden on desktop
    const hamburger = page.locator('#hamburger')
    await expect(hamburger).not.toBeVisible()

    // Check main content is properly displayed
    const main = page.locator('main')
    await expect(main).toBeVisible()

    // Check footer is visible
    const footer = page.locator('footer')
    await expect(footer).toBeVisible()
  })

  test('should display correctly on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })

    // Check responsive layout adjustments
    const container = page.locator('.container').first()
    await expect(container).toBeVisible()

    // Check that content adapts to tablet size
    const heroSection = page
      .locator('[data-testid="hero-section"], .hero, h1')
      .first()
    await expect(heroSection).toBeVisible()
  })

  test('should display correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    // Check hamburger menu is visible on mobile
    const hamburger = page.locator('#hamburger')
    await expect(hamburger).toBeVisible()

    // Check desktop navigation is hidden on mobile
    const desktopNav = page.locator('nav ul').first()
    await expect(desktopNav).not.toBeVisible()

    // Check mobile navigation is initially hidden
    const mobileNav = page.locator('#navlinks')
    await expect(mobileNav).toHaveClass(/hidden/)
  })

  test('should toggle mobile navigation correctly', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    const hamburger = page.locator('#hamburger')
    const mobileNav = page.locator('#navlinks')
    const navLayer = page.locator('#navLayer')

    // Initially mobile nav should be hidden
    await expect(mobileNav).toHaveClass(/hidden/)
    await expect(navLayer).toHaveClass(/scale-y-0/)

    // Click hamburger to open mobile menu
    await hamburger.click()

    // Mobile nav should now be visible
    await expect(mobileNav).not.toHaveClass(/hidden/)
    await expect(navLayer).toHaveClass(/scale-y-100/)

    // Check aria-expanded is set correctly
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true')

    // Click hamburger again to close mobile menu
    await hamburger.click()

    // Mobile nav should be hidden again
    await expect(mobileNav).toHaveClass(/hidden/)
    await expect(navLayer).toHaveClass(/scale-y-0/)
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })

  test('should close mobile menu when clicking navigation links', async ({
    page,
  }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    const hamburger = page.locator('#hamburger')
    const mobileNav = page.locator('#navlinks')

    // Open mobile menu
    await hamburger.click()
    await expect(mobileNav).not.toHaveClass(/hidden/)

    // Click on a navigation link
    const navLink = mobileNav.locator('a').first()
    await navLink.click()

    // Mobile nav should close
    await expect(mobileNav).toHaveClass(/hidden/)
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })

  test('should close mobile menu when clicking backdrop', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    const hamburger = page.locator('#hamburger')
    const mobileNav = page.locator('#navlinks')
    const navLayer = page.locator('#navLayer')

    // Open mobile menu
    await hamburger.click()
    await expect(mobileNav).not.toHaveClass(/hidden/)

    // Click on the backdrop
    await navLayer.click()

    // Mobile nav should close
    await expect(mobileNav).toHaveClass(/hidden/)
    await expect(hamburger).toHaveAttribute('aria-expanded', 'false')
  })

  test('should have working navigation links', async ({ page }) => {
    // Test navigation links work correctly
    const navLinks = page.locator('nav a')
    const linkCount = await navLinks.count()

    expect(linkCount).toBeGreaterThan(0)

    // Check that links have proper href attributes
    // Get all links first, then check them in parallel
    const linkPromises = []
    for (let i = 0; i < Math.min(linkCount, 5); i++) {
      const link = navLinks.nth(i)
      linkPromises.push(
        link.getAttribute('href').then((href) => {
          expect(href).toBeTruthy()
        }),
      )
    }

    // Wait for all link checks to complete
    await Promise.all(linkPromises)
  })

  test('should have accessible navigation', async ({ page }) => {
    // Check skip to content link
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeInViewport()

    // Check hamburger has proper aria attributes
    const hamburger = page.locator('#hamburger')
    await expect(hamburger).toHaveAttribute('aria-label')

    // Check navigation has proper structure
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
  })

  test('should maintain layout integrity across breakpoints', async ({
    page,
  }) => {
    const breakpoints = [
      { width: 320, height: 568 }, // Small mobile
      { width: 375, height: 667 }, // Mobile
      { width: 768, height: 1024 }, // Tablet
      { width: 1024, height: 768 }, // Small desktop
      { width: 1920, height: 1080 }, // Large desktop
    ]

    // Create promises for each breakpoint check
    const breakpointPromises = breakpoints.map(async (viewport) => {
      await page.setViewportSize(viewport)

      // Check that main content is visible
      const main = page.locator('main')
      await expect(main).toBeVisible()

      // Check that there's no horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
      const viewportWidth = viewport.width
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20) // Allow small tolerance

      // Check that header and footer are visible
      const header = page.locator('header')
      const footer = page.locator('footer')
      await expect(header).toBeVisible()
      await expect(footer).toBeVisible()
    })

    // Wait for all breakpoint checks to complete
    await Promise.all(breakpointPromises)
  })

  test('should have proper button and link interactions', async ({ page }) => {
    // Test CTA buttons in hero section
    const ctaButtons = page.locator('a[href="/demo"], a[href="/get-started"]')
    const buttonCount = await ctaButtons.count()

    if (buttonCount > 0) {
      // Create promises for each button check
      const buttonPromises = []
      for (let i = 0; i < buttonCount; i++) {
        const button = ctaButtons.nth(i)
        buttonPromises.push(expect(button).toBeVisible())
        buttonPromises.push(expect(button).toHaveAttribute('href'))
      }

      // Wait for all button checks to complete
      await Promise.all(buttonPromises)
    }

    // Test footer links
    const footerLinks = page.locator('footer a')
    const footerLinkCount = await footerLinks.count()

    if (footerLinkCount > 0) {
      // Create promises for each footer link check
      const footerLinkPromises = []
      for (let i = 0; i < Math.min(footerLinkCount, 3); i++) {
        const link = footerLinks.nth(i)
        footerLinkPromises.push(expect(link).toBeVisible())
      }

      // Wait for all footer link checks to complete
      await Promise.all(footerLinkPromises)
    }
  })

  test('should handle touch interactions on mobile', async ({
    page,
    isMobile,
  }) => {
    if (!isMobile) {
      test.skip('Skipping touch test on non-mobile device')
    }

    await page.setViewportSize({ width: 375, height: 667 })

    const hamburger = page.locator('#hamburger')
    const mobileNav = page.locator('#navlinks')

    // Test touch interaction with hamburger menu
    await hamburger.tap()
    await expect(mobileNav).not.toHaveClass(/hidden/)

    await hamburger.tap()
    await expect(mobileNav).toHaveClass(/hidden/)
  })
})
