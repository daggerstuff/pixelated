// @vitest-environment node

import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  getPortFallbackPolicy,
  resolveSsrEntryModuleUrl,
} from '../../scripts/utils/start-server-config.mjs'

describe('start-server port fallback policy', () => {
  it('keeps port fallback enabled when no explicit production guard is present', () => {
    const policy = getPortFallbackPolicy({})

    expect(policy.isFallbackDisabled).toBe(false)
    expect(policy.reasons).toEqual([])
  })

  it('disables port fallback when PORT is explicitly configured', () => {
    const policy = getPortFallbackPolicy({ PORT: '4321' })

    expect(policy.isFallbackDisabled).toBe(true)
    expect(policy.reasons).toContain('PORT is explicitly configured')
  })

  it('disables port fallback in production mode', () => {
    const policy = getPortFallbackPolicy({ NODE_ENV: 'production' })

    expect(policy.isFallbackDisabled).toBe(true)
    expect(policy.reasons).toContain('NODE_ENV=production')
  })

  it('disables port fallback when explicit opt-out flags are set', () => {
    const policy = getPortFallbackPolicy({
      NO_PORT_FALLBACK: '1',
      FORCE_EXIT_ON_EADDRINUSE: '1',
    })

    expect(policy.isFallbackDisabled).toBe(true)
    expect(policy.reasons).toContain('NO_PORT_FALLBACK is set')
    expect(policy.reasons).toContain('FORCE_EXIT_ON_EADDRINUSE is set')
  })

  it('resolves the SSR entry from the current working directory by default', () => {
    const cwd = '/workspace/pixelated'

    const moduleUrl = resolveSsrEntryModuleUrl({ cwd, env: {} })

    expect(moduleUrl).toBe(
      pathToFileURL(path.resolve(cwd, 'dist/server/entry.mjs')).href,
    )
  })

  it('uses SSR_ENTRY_FILE when an explicit entry path is provided', () => {
    const moduleUrl = resolveSsrEntryModuleUrl({
      cwd: '/workspace/pixelated',
      env: {
        SSR_ENTRY_FILE: '/tmp/releases/current/dist/server/entry.mjs',
      },
    })

    expect(moduleUrl).toBe(
      pathToFileURL('/tmp/releases/current/dist/server/entry.mjs').href,
    )
  })
})
