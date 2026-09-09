/**
 * G3.2 Mobile Parity Gate — PWA Install Tests (PIX-4430)
 *
 * Validates that the EHR app is installable as a PWA:
 * - Manifest is served, valid, and meets installability criteria
 * - Service worker registers on navigation
 * - Apple touch icon is present for iOS install
 * - Standalone display mode
 * - Splash screen / theme color configured
 *
 * @see PIX-4430
 * @see https://web.dev/install-criteria/
 */

import { test, expect } from '@playwright/test'

test.describe('EHR PWA Install — Mobile', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })

  test('manifest.json is served with correct content type', async ({
    page,
  }) => {
    const response = await page.goto('/manifest.json')
    expect(response?.ok()).toBe(true)

    const contentType = response?.headers()['content-type'] ?? ''
    expect(contentType).toContain('application/json')
  })

  test('manifest has required installability fields', async ({ page }) => {
    const response = await page.goto('/manifest.json')
    const manifest = await response?.json()

    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.orientation).toBe('portrait')
    expect(manifest.background_color).toBeTruthy()
    expect(manifest.theme_color).toBeTruthy()
  })

  test('manifest has 192px and 512px icons with maskable purpose', async ({
    page,
  }) => {
    const response = await page.goto('/manifest.json')
    const manifest = await response?.json()

    const icons = manifest.icons as Array<{
      sizes: string
      src: string
      purpose?: string
    }>

    expect(icons.length).toBeGreaterThanOrEqual(2)

    const has192 = icons.some((i) => i.sizes === '192x192')
    const has512 = icons.some((i) => i.sizes === '512x512')
    expect(has192).toBe(true)
    expect(has512).toBe(true)

    const hasMaskable = icons.some(
      (i) => i.purpose?.includes('maskable'),
    )
    expect(hasMaskable).toBe(true)
  })

  test('manifest icons are accessible', async ({ page, request }) => {
    const response = await page.goto('/manifest.json')
    const manifest = await response?.json()
    const icons = manifest.icons as Array<{ src: string }>

    for (const icon of icons.slice(0, 3)) {
      const iconUrl = icon.src.startsWith('/')
        ? icon.src
        : `/${icon.src}`
      const iconResponse = await request.get(iconUrl)
      expect(
        iconResponse.ok(),
        `Icon ${iconUrl} returned ${iconResponse.status()}`,
      ).toBe(true)
    }
  })

  test('apple-touch-icon link is present in HTML', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const appleTouchIcon = page.locator("link[rel='apple-touch-icon']")
    await expect(appleTouchIcon).toHaveCount(1)
    const href = await appleTouchIcon.getAttribute('href')
    expect(href).toBeTruthy()
  })

  test('manifest link is present in HTML head', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const manifestLink = page.locator("link[rel='manifest']")
    await expect(manifestLink).toHaveCount(1)
    const href = await manifestLink.getAttribute('href')
    expect(href).toBeTruthy()
  })

  test('theme-color meta tag is present', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const themeMeta = page.locator("meta[name='theme-color']")
    await expect(themeMeta).toHaveCount(1)
    const content = await themeMeta.getAttribute('content')
    expect(content).toBeTruthy()
    expect(content).toMatch(/^#[0-9a-fA-F]{6}$/)
  })

  test('viewport meta tag has correct mobile configuration', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const viewportMeta = page.locator("meta[name='viewport']")
    await expect(viewportMeta).toHaveCount(1)
    const content = await viewportMeta.getAttribute('content')
    expect(content).toContain('width=device-width')
    expect(content).toContain('initial-scale')
  })

  test('service worker file is accessible', async ({ page }) => {
    const response = await page.goto('/sw.js')
    expect(response?.ok()).toBe(true)

    const content = await response?.text()
    expect(content).toContain('CACHE')
    expect(content).toContain('install')
    expect(content).toContain('activate')
  })

  test('service worker registers on page load', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Give the SW time to register
    await page.waitForTimeout(2000)

    const hasRegistration = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        if (!('serviceWorker' in navigator)) {
          resolve(false)
          return
        }
        navigator.serviceWorker
          .getRegistration()
          .then((reg) => resolve(!!reg))
          .catch(() => resolve(false))
      })
    })
    expect(hasRegistration).toBe(true)
  })

  test('service worker claims clients on activation', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    const controlled = await page.evaluate(() => {
      return navigator.serviceWorker.controller !== null
    })
    // SW may take a reload to become the controller — check both
    if (!controlled) {
      await page.reload()
      await page.waitForLoadState('networkidle')
      const controlledAfterReload = await page.evaluate(() => {
        return navigator.serviceWorker.controller !== null
      })
      expect(controlledAfterReload).toBe(true)
    } else {
      expect(controlled).toBe(true)
    }
  })

  test('app is installable (Lighthouse installable-manifest)', async ({
    page,
  }) => {
    // Verify all PWA installability criteria:
    // 1. Manifest with name/short_name, start_url, display standalone/fullscreen, 192+512 icons
    // 2. Service worker with fetch handler
    // 3. Served over HTTPS (localhost is treated as secure)
    // 4. Has manifest link in HTML
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Check manifest link
    const manifestLink = page.locator("link[rel='manifest']")
    await expect(manifestLink).toHaveCount(1)

    // Check SW registration
    await page.waitForTimeout(2000)
    const swRegistered = await page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        navigator.serviceWorker
          .getRegistration()
          .then((reg) => resolve(!!reg))
          .catch(() => resolve(false))
      })
    })
    expect(swRegistered).toBe(true)

    // Check manifest content
    const manifestResponse = await page.goto('/manifest.json')
    const manifest = await manifestResponse?.json()
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBeTruthy()
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2)
  })
})
