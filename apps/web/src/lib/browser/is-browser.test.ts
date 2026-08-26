import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('isBrowser utility', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('evaluates to false when window and document are undefined', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)

    const module = await import('./is-browser')

    expect(module.isBrowser).toBe(false)
    expect(module.default).toBe(false)
  })

  it('evaluates to true when window and document are defined', async () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {})

    const module = await import('./is-browser')

    expect(module.isBrowser).toBe(true)
    expect(module.default).toBe(true)
  })
})
