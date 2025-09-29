import { Page, expect } from '@playwright/test'

/**
 * Test utilities for browser compatibility tests
 */

export interface TestPageInfo {
  url: string
  name: string
  requiresAuth?: boolean
}

export const TEST_PAGES: TestPageInfo[] = [
  { url: '/', name: 'Home' },
  { url: '/blog', name: 'Blog' },
  { url: '/docs', name: 'Documentation' },
  { url: '/admin/dashboard', name: 'Admin Dashboard', requiresAuth: true },
  { url: '/contact', name: 'Contact' },
]

/**
 * Navigate to a page with proper error handling
 */
export async function navigateToPage(page: Page, url: string, options: { timeout?: number } = {}) {
  const { timeout = 30000 } = options

  try {
    const response = await page.goto(url, { timeout })

    if (url.includes('/admin')) {
      console.log(`Admin page redirected to: ${page.url()}`)
      return response
    }

    if (!response || !response.ok()) {
      throw new Error(`Navigation failed: ${response ? response.status() : 'No response'}`)
    }

    return response
  } catch (_error) {
    console.error(`Failed to navigate to ${url}:`, _error)

    await page.screenshot({
      path: `./test-results/navigation-error-${url.replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}.png`,
    })

    throw _error
  }
}

/**
 * Check if page has expected elements based on page type
 */
export async function verifyPageElements(page: Page, pageInfo: TestPageInfo) {
  const { requiresAuth } = pageInfo

  if (requiresAuth) {
    await waitForPageStable(page, { timeout: 30000 })

    const hasLoginForm = (await page.locator('form').count()) > 0
    const hasEmailInput = (await page.locator('input[type="email"], input#email, input[name="email"], input[aria-label*="email" i]').count()) > 0
    const hasPasswordInput = (await page.locator('input[type="password"], input#password, input[name="password"], input[aria-label*="password" i]').count()) > 0

    const mainVisible = (await page.locator('main').count()) > 0 && (await page.locator('main').isVisible())

    expect((hasLoginForm && hasEmailInput && hasPasswordInput) || mainVisible).toBeTruthy()
  } else {
    await expect(page.locator('main')).toBeVisible({ timeout: 30000 })
  }
}

/**
 * Check for horizontal overflow on mobile
 */
export async function checkHorizontalOverflow(page: Page, deviceName: string, pageName: string) {
  const overflowInfo = await page.evaluate(() => {
    const bodyWidth = document.body.scrollWidth
    const viewportWidth = window.innerWidth
    return {
      hasOverflow: bodyWidth > viewportWidth,
      bodyWidth,
      viewportWidth,
      difference: bodyWidth - viewportWidth,
    }
  })

  if (overflowInfo.hasOverflow) {
    console.warn(
      `Horizontal overflow detected on ${pageName} page on ${deviceName}: ` +
      `Body width: ${overflowInfo.bodyWidth}px, Viewport: ${overflowInfo.viewportWidth}px, ` +
      `Overflow: ${overflowInfo.difference}px`
    )

    // Take screenshot for debugging
    await page.screenshot({
      path: `./test-results/mobile/${deviceName.replace(/\s+/g, '-')}-${pageName}-overflow.png`,
    })

    // Only fail for significant overflow (> 50px)
    if (overflowInfo.difference > 50) {
      throw new Error(`Significant horizontal overflow: ${overflowInfo.difference}px`)
    }
  }

  return overflowInfo
}

/**
 * Wait for page to be fully loaded and stable
 */
export async function waitForPageStable(page: Page, options: { timeout?: number } = {}) {
  const { timeout = 30000 } = options

  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout })

  // Wait a bit more for any animations or dynamic content
  await page.waitForTimeout(1000)
}

/**
 * Create test results directory
 */
export async function ensureTestResultsDir(subDir?: string) {
  const { mkdir } = await import('fs/promises')
  const path = subDir ? `./test-results/${subDir}` : './test-results'

  try {
    await mkdir(path, { recursive: true })
  } catch (_error) {
    // Directory might already exist, ignore error
  }
}
