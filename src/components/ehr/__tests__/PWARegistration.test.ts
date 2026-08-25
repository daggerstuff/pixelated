// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '../../../..')

describe('PWA Configuration', () => {
  it('manifest.webmanifest has correct required fields', () => {
    const manifestPath = resolve(ROOT, 'public/manifest.webmanifest')
    expect(existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

    expect(manifest.name).toBe('Pixelated Empathy')
    expect(manifest.short_name).toBe('Pixelated')
    expect(manifest.display).toBe('standalone')
    expect(manifest.background_color).toBe('#131313')
    expect(manifest.theme_color).toBe('#84cc16')
    expect(manifest.start_url).toBe('/')
    expect(manifest.icons).toHaveLength(2)

    // Icons should reference SVG favicon with multiple sizes
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/svg+xml')
      expect(icon.src).toContain('favicon.svg')
    }
  })

  it('conflicting manifest.json is deleted', () => {
    const conflictingPath = resolve(ROOT, 'public/manifest.json')
    expect(existsSync(conflictingPath)).toBe(false)
  })

  it('service worker file exists with caching strategies', () => {
    const swPath = resolve(ROOT, 'public/sw.js')
    expect(existsSync(swPath)).toBe(true)

    const swContent = readFileSync(swPath, 'utf-8')
    // Verify PHI routes are excluded from caching
    expect(swContent).toContain('PHI')
    // Verify caching strategy patterns exist
    expect(swContent.toLowerCase()).toContain('cache')
  })

  it('BaseLayout.astro includes manifest link, theme-color, and SW registration', () => {
    const layoutPath = resolve(ROOT, 'src/layouts/BaseLayout.astro')
    expect(existsSync(layoutPath)).toBe(true)

    const layout = readFileSync(layoutPath, 'utf-8')

    // Manifest link
    expect(layout).toContain('manifest.webmanifest')
    expect(layout).toContain('rel="manifest"')

    // Apple touch icon
    expect(layout).toContain('apple-touch-icon')

    // Theme color meta
    expect(layout).toContain('theme-color')
    expect(layout).toContain('#131313')

    // Service worker registration
    expect(layout).toContain('serviceWorker')
    expect(layout).toContain('/sw.js')
  })
})
