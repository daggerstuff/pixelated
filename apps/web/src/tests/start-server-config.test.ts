// @vitest-environment node

import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { isLocalDevelopmentRun } from '../../../../config/sentry-event-filter.mjs'
import {
  getPortFallbackPolicy,
  resolveSsrEntryModuleUrl,
} from '../../../../scripts/utils/start-server-config.mjs'

type ReadFileSyncStub = (path: string, encoding: string) => string

/**
 * Build a readFileSync stub from a map of file-path → content. Any path not
 * in the map throws ENOENT, matching real filesystem behavior.
 */
const makeReadFileSyncStub = (
  files: Record<string, string>,
): ReadFileSyncStub => {
  return (requestedPath, encoding) => {
    if (Object.prototype.hasOwnProperty.call(files, requestedPath)) {
      return files[requestedPath]
    }
    const error = new Error(
      `ENOENT: no such file or directory, open '${requestedPath}'`,
    ) as NodeJS.ErrnoException
    error.code = 'ENOENT'
    throw error
  }
}

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

  it('resolves the SSR entry from the current working directory by default', async () => {
    const cwd = '/workspace/pixelated'

    const moduleUrl = await resolveSsrEntryModuleUrl({ cwd, env: {} })

    expect(moduleUrl).toBe(
      pathToFileURL(path.resolve(cwd, 'dist/server/entry2.mjs')).href,
    )
  })

  it('uses SSR_ENTRY_FILE when an explicit entry path is provided', async () => {
    const moduleUrl = await resolveSsrEntryModuleUrl({
      cwd: '/workspace/pixelated',
      env: {
        SSR_ENTRY_FILE: '/tmp/releases/current/dist/server/entry.mjs',
      },
    })

    expect(moduleUrl).toBe(
      pathToFileURL('/tmp/releases/current/dist/server/entry.mjs').href,
    )
  })

  it('survives a broken candidate module during handler discovery', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'start-server-test-'))
    const serverDir = path.join(root, 'dist', 'server')
    await mkdir(serverDir, { recursive: true })

    // The repo root is type:module; mirror that so .js fixtures are ESM, just
    // like dist/server/index.js in the real runtime.
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n')

    // A stale/corrupt internal bundle that throws at module scope. Before the
    // fix, importing it rejected the whole resolution and crashed the boot.
    await writeFile(
      path.join(serverDir, 'broken.js'),
      `throw new TypeError("Cannot read properties of undefined (reading 'length')");\n`,
    )
    await writeFile(
      path.join(serverDir, 'index.js'),
      'export const handler = () => {};\n',
    )

    try {
      const moduleUrl = await resolveSsrEntryModuleUrl({ cwd: root, env: {} })

      expect(moduleUrl).toBe(
        pathToFileURL(path.join(serverDir, 'index.js')).href,
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('falls back to the default entry when no candidate exports a handler', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'start-server-test-'))
    const serverDir = path.join(root, 'dist', 'server')
    await mkdir(serverDir, { recursive: true })
    await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n')
    await writeFile(path.join(serverDir, 'entry2.mjs'), 'export const x = 1;\n')

    try {
      const moduleUrl = await resolveSsrEntryModuleUrl({ cwd: root, env: {} })

      expect(moduleUrl).toBe(
        pathToFileURL(path.join(serverDir, 'entry2.mjs')).href,
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})

describe('isLocalDevelopmentRun', () => {
  it('detects a bare-metal local run (no container signals)', () => {
    const readFileSync = makeReadFileSyncStub({
      '/proc/1/cgroup': '0::/init.scope\n',
    })

    expect(isLocalDevelopmentRun({ env: {}, readFileSync })).toBe(true)
  })

  it('detects a Docker container via /.dockerenv', () => {
    const readFileSync = makeReadFileSyncStub({
      '/.dockerenv': '',
      '/proc/1/cgroup': '0::/init.scope\n',
    })

    expect(isLocalDevelopmentRun({ env: {}, readFileSync })).toBe(false)
  })

  it('detects a Kubernetes pod via the cgroup unified hierarchy', () => {
    const readFileSync = makeReadFileSyncStub({
      '/proc/1/cgroup': '0::/system.slice/containerd.service\n',
    })

    expect(isLocalDevelopmentRun({ env: {}, readFileSync })).toBe(false)
  })

  it('trusts the KUBERNETES_SERVICE_HOST env var', () => {
    expect(
      isLocalDevelopmentRun({
        env: { KUBERNETES_SERVICE_HOST: '10.0.0.1' },
        readFileSync: makeReadFileSyncStub({}),
      }),
    ).toBe(false)
  })

  it('trusts the VERCEL env var', () => {
    expect(
      isLocalDevelopmentRun({
        env: { VERCEL: '1' },
        readFileSync: makeReadFileSyncStub({}),
      }),
    ).toBe(false)
  })

  it('can be disabled with SENTRY_ALLOW_LOCAL_EVENTS=1', () => {
    const readFileSync = makeReadFileSyncStub({
      '/proc/1/cgroup': '0::/init.scope\n',
    })

    expect(
      isLocalDevelopmentRun({
        env: { SENTRY_ALLOW_LOCAL_EVENTS: '1' },
        readFileSync,
      }),
    ).toBe(false)
  })

  it('treats unreadable /proc as containerized (fail safe: do not drop)', () => {
    const readFileSync = vi.fn().mockImplementation(() => {
      throw new Error('EACCES: permission denied')
    })

    expect(isLocalDevelopmentRun({ env: {}, readFileSync })).toBe(false)
  })
})
