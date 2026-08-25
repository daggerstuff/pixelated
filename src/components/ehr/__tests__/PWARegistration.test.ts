/* @vitest-environment node */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getServiceWorkerScope,
  getServiceWorkerScriptUrl,
  normalizeBasePath,
} from '@/utils/serviceWorkerPath'
import { serviceWorkerManager } from '@/utils/serviceWorkerRegistration'

const ROOT = resolve(__dirname, '../../../..')

describe('PWA Configuration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('manifest.webmanifest resolves install paths relative to the manifest base', () => {
    const manifestPath = resolve(ROOT, 'public/manifest.webmanifest')
    expect(existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

    expect(manifest.name).toBe('Pixelated Empathy')
    expect(manifest.short_name).toBe('Pixelated')
    expect(manifest.display).toBe('standalone')
    expect(manifest.background_color).toBe('#131313')
    expect(manifest.theme_color).toBe('#84cc16')
    expect(manifest.start_url).toBe('./')
    expect(manifest.icons).toHaveLength(2)

    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/svg+xml')
      expect(icon.src).toBe('./favicon.svg')
    }
  })

  it('conflicting manifest.json is deleted', () => {
    const conflictingPath = resolve(ROOT, 'public/manifest.json')
    expect(existsSync(conflictingPath)).toBe(false)
  })

  it('service worker helpers resolve against the deployment base', () => {
    expect(normalizeBasePath('/')).toBe('/')
    expect(normalizeBasePath('/tenant')).toBe('/tenant/')
    expect(getServiceWorkerScope('/tenant')).toBe('/tenant/')
    expect(getServiceWorkerScriptUrl('/tenant')).toBe('/tenant/sw.js')
  })

  it('service worker registration uses the resolved script path and scope', async () => {
    const register = vi.fn().mockResolvedValue(undefined)

    vi.stubGlobal('navigator', {
      serviceWorker: {
        register,
      },
    })

    await serviceWorkerManager.register()

    expect(register).toHaveBeenCalledWith(getServiceWorkerScriptUrl(), {
      scope: getServiceWorkerScope(),
    })
  })
})
