// @vitest-environment node

import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { rewriteSentrySource } from '../../../../../config/sentry-source-map.mjs'

describe('Sentry sourcemap source rewriting', () => {
  it('rewrites Astro virtual script sources to their component file', () => {
    const source = path.join(
      process.cwd(),
      'apps/web/src/components/ThemeSwitcher.astro?astro&type=script&index=0&lang.ts',
    )

    expect(rewriteSentrySource(source)).toBe(
      'apps/web/src/components/ThemeSwitcher.astro',
    )
  })

  it('preserves normal relative source paths', () => {
    expect(rewriteSentrySource('apps/web/src/components/Navbar.astro')).toBe(
      'apps/web/src/components/Navbar.astro',
    )
  })

  it('normalizes protocol-prefixed sourcemap sources', () => {
    expect(
      rewriteSentrySource(
        'webpack:///apps/web/src/components/ThemeSwitcher.astro?astro&type=script',
      ),
    ).toBe('apps/web/src/components/ThemeSwitcher.astro')
  })
})
