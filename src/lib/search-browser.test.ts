/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest'

import { initBrowserSearch } from './search-browser'

describe('search-browser', () => {
  it('returns an SSR-safe fallback client when window is undefined', async () => {
    const client = await initBrowserSearch()

    expect(client.search('anything')).toEqual([])
    expect(() => client.importDocuments([])).not.toThrow()
  })

  it('logs a warning when falling back to the SSR stub', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const client = await initBrowserSearch()
    client.search('query')

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[build-safe-logger][search-browser]'),
      expect.stringContaining('Using fallback search implementation'),
    )

    warnSpy.mockRestore()
  })
})
