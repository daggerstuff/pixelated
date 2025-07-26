import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import { join } from 'node:path'
import { FEATURES } from '../lib/browser/feature-detection'

// Define types for compatibility results
interface PageResult {
  navigationSuccessful?: boolean
  visualIssues?: string[]
  criticalElements?: Record<string, boolean>
  interactions?: Record<string, { success: boolean; details?: string }>
  jsErrors?: string[]
  viewportAdaption?: {
    viewport: { width: number; height: number }
    hasViewportMeta: boolean
    hasHorizontalOverflow: boolean
    tooSmallTapTargets: Element[]
  }
  touchInputResults?: Record<string, { success: boolean; details?: string }>
  accessibilityLandmarks?: {
    navigationLandmark: boolean
    bannerLandmark: boolean
    duplicateHeaderLandmarks: boolean
  }
  responsiveNavigation?: {
    mobileMenuHidden: boolean
    desktopMenuVisible: boolean
  }
}

interface CompatibilityResults {
  browsers: Record<
    string,
    {
      pages: Record<string, PageResult>
      features: Record<string, boolean>
    }
  >
}

// Skip browser compatibility tests in CI environment
const skipTests = process.env.SKIP_BROWSER_COMPAT_TESTS === 'true'

// Use conditional test execution with Playwright's test.describe
const testGroup = skipTests ? test.describe.skip : test.describe

testGroup('Cross-Browser Compatibility', () => {
  test('should test browser features and compatibility', async ({ page }) => {
    console.log('🚀 Starting browser feature compatibility test...')

    const compatibilityResults: CompatibilityResults = {
      browsers: {},
    }

    // Test each feature
    console.log(
      `📋 Testing ${Object.keys(FEATURES).length} browser features...`,
    )
    for (const [featureKey, feature] of Object.entries(FEATURES)) {
      console.log(`  ✓ Testing feature: ${featureKey}`)
      const detectionCode = feature.detectionFn.toString()
      const result = await page.evaluate(`(${detectionCode})()`)
      compatibilityResults.browsers['chromium'] = {
        ...compatibilityResults.browsers['chromium'],
        features: {
          ...compatibilityResults.browsers['chromium']?.features,
          [featureKey]: Boolean(result),
        },
      }
    }

    // Save results
    const resultsPath = join(
      process.cwd(),
      'browser-compatibility-results.json',
    )
    await fs.writeFile(
      resultsPath,
      JSON.stringify(compatibilityResults, null, 2),
    )

    // Basic assertion to ensure test ran
    expect(Object.keys(compatibilityResults.browsers)).toHaveLength(1)

    console.log('✅ Browser feature compatibility test COMPLETED successfully!')
  })

  test('should work correctly across browsers', async ({
    page,
    browserName,
  }) => {
    console.log(
      `🌐 Starting cross-browser navigation test for ${browserName}...`,
    )

    console.log('📄 Loading homepage...')
    await page.goto('/')

    console.log('🔍 Testing accessibility landmarks...')
    // Test accessibility landmarks
    const navigationLandmark = await page
      .locator('nav[role="navigation"]')
      .count()
    const bannerLandmarks = await page.locator('[role="banner"]').count()
    const headerElements = await page.locator('header').count()

    // Verify single navigation landmark exists
    expect(navigationLandmark).toBe(1)
    console.log('  ✓ Navigation landmark found')

    // Verify banner landmark exists
    expect(bannerLandmarks).toBe(1)
    console.log('  ✓ Banner landmark found')

    // Verify no duplicate header landmarks (should have banner role instead)
    expect(headerElements).toBeLessThanOrEqual(1)
    console.log('  ✓ No duplicate header landmarks')

    console.log('📱 Testing responsive navigation - Desktop mode...')
    // Test responsive navigation - Desktop
    await page.setViewportSize({ width: 768, height: 1024 })
    const desktopNavVisible = await page.locator('nav ul').first().isVisible()
    expect(desktopNavVisible).toBe(true)
    console.log('  ✓ Desktop navigation visible')

    // Hamburger should be hidden on desktop
    const hamburgerHiddenDesktop = await page.locator('.hamburger').isVisible()
    expect(hamburgerHiddenDesktop).toBe(false)
    console.log('  ✓ Hamburger menu hidden on desktop')

    console.log('📱 Testing responsive navigation - Mobile mode...')
    // Test responsive navigation - Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    const mobileNavHidden = await page.locator('nav ul.hidden').count()
    expect(mobileNavHidden).toBe(1)
    console.log('  ✓ Mobile navigation hidden by default')

    // Hamburger should be visible on mobile
    const hamburgerVisibleMobile = await page.locator('.hamburger').isVisible()
    expect(hamburgerVisibleMobile).toBe(true)
    console.log('  ✓ Hamburger menu visible on mobile')

    console.log('🍔 Testing mobile menu toggle functionality...')
    // Test mobile menu toggle functionality
    const mobileMenu = page.locator('#mobile-menu')
    await expect(mobileMenu).toHaveClass(/hidden/)
    console.log('  ✓ Mobile menu initially hidden')

    // Click hamburger to open mobile menu
    await page.locator('.hamburger').click()
    await expect(mobileMenu).not.toHaveClass(/hidden/)
    console.log('  ✓ Mobile menu opens when hamburger clicked')

    // Check aria-expanded is set correctly
    const ariaExpanded = await page
      .locator('.hamburger')
      .getAttribute('aria-expanded')
    expect(ariaExpanded).toBe('true')
    console.log('  ✓ Aria-expanded set correctly')

    // Click a navigation link in mobile menu
    const firstMobileLink = mobileMenu.locator('a').first()
    await firstMobileLink.click()
    console.log('  ✓ Clicked first navigation link')

    // Mobile menu should close after clicking a link
    await expect(mobileMenu).toHaveClass(/hidden/)
    console.log('  ✓ Mobile menu closes after link click')

    console.log('♿ Testing navigation accessibility...')
    // Test navigation accessibility
    const navElement = page.locator('nav[aria-label="Main navigation"]')
    await expect(navElement).toBeVisible()
    console.log('  ✓ Navigation has proper aria-label')

    // Test that navigation links are accessible
    const navLinks = page.locator('nav a')
    const linkCount = await navLinks.count()
    expect(linkCount).toBeGreaterThan(0)
    console.log(`  ✓ Found ${linkCount} navigation links`)

    // Verify each link has proper accessible attributes
    console.log('  🔍 Checking accessibility of each link...')
    for (let i = 0; i < linkCount; i++) {
      const link = navLinks.nth(i)
      const hasText = await link.textContent()
      const hasAriaLabel = await link.getAttribute('aria-label')

      // Each link should have either text content or aria-label
      expect(hasText || hasAriaLabel).toBeTruthy()
      console.log(`    ✓ Link ${i + 1}: ${hasText || hasAriaLabel}`)
    }

    console.log(
      `🎉 Cross-browser navigation test for ${browserName} COMPLETED successfully!`,
    )
    console.log('================================================')
  })
})
