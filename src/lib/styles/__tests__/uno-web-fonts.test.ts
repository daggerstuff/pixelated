import { describe, expect, it } from 'vitest'

import { shouldDisableRemoteWebFonts } from '@/lib/styles/uno-web-fonts'

describe('shouldDisableRemoteWebFonts', () => {
  it('disables remote font fetching on Vercel builds', () => {
    expect(
      shouldDisableRemoteWebFonts({
        NODE_ENV: 'production',
        VERCEL: '1',
      }),
    ).toBe(true)
    expect(
      shouldDisableRemoteWebFonts({
        NODE_ENV: 'production',
        VERCEL_ENV: 'preview',
      }),
    ).toBe(true)
  })

  it('keeps remote font fetching enabled in local development', () => {
    expect(
      shouldDisableRemoteWebFonts({
        NODE_ENV: 'development',
      }),
    ).toBe(false)
  })
})
