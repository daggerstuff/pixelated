/* @vitest-environment node */
/**
 * GET /api/auth/csrf route tests.
 *
 * The response contract is unchanged: 200 `{csrfToken, expiresAt}` when the
 * token is stored, 503 `{error}` when no store is available.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET } from '../csrf'

const CSRF_TOKEN = 'a'.repeat(64)

vi.mock('../../../../lib/security', () => ({
  secureRandomHex: () => CSRF_TOKEN,
}))

vi.mock('../../../../lib/redis', () => ({
  getFromCache: vi.fn(async () => null),
  setInCache: vi.fn(async () => false),
}))

interface FakeKv {
  entries: Map<string, string>
  puts: Array<{ key: string; value: string; expirationTtl?: number }>
  get(key: string): Promise<string | null>
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>
}

function createFakeKv(): FakeKv {
  const entries = new Map<string, string>()
  const puts: Array<{ key: string; value: string; expirationTtl?: number }> = []
  return {
    entries,
    puts,
    async get(key: string) {
      return entries.get(key) ?? null
    },
    async put(
      key: string,
      value: string,
      options?: { expirationTtl?: number },
    ) {
      puts.push({ key, value, expirationTtl: options?.expirationTtl })
      entries.set(key, value)
    },
  }
}

type ApiContext = Parameters<typeof GET>[0]

function callGet(locals?: unknown): Promise<Response> {
  return GET({ locals } as unknown as ApiContext) as Promise<Response>
}

describe('GET /api/auth/csrf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mints a token into the KV binding and returns {csrfToken, expiresAt}', async () => {
    const kv = createFakeKv()
    const before = Date.now()

    const response = await callGet({
      runtime: { env: { CSRF_TOKENS: kv } },
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(Object.keys(body).sort()).toEqual(['csrfToken', 'expiresAt'])
    expect(body.csrfToken).toBe(CSRF_TOKEN)
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000)
    expect(body.expiresAt).toBeLessThanOrEqual(Date.now() + 3_600_000)

    expect(kv.puts).toHaveLength(1)
    expect(kv.puts[0]?.key).toBe(`csrf:${CSRF_TOKEN}`)
    expect(kv.puts[0]?.expirationTtl).toBe(3600)
    expect(JSON.parse(kv.puts[0]?.value ?? '')).toEqual({
      token: CSRF_TOKEN,
      expiresAt: body.expiresAt,
    })
  })

  it('falls back to the Redis cache when no KV binding is present', async () => {
    const { setInCache } = await import('../../../../lib/redis')
    vi.mocked(setInCache).mockResolvedValueOnce(true)

    const response = await callGet()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.csrfToken).toBe(CSRF_TOKEN)
    expect(setInCache).toHaveBeenCalledWith(
      `csrf:${CSRF_TOKEN}`,
      expect.objectContaining({ token: CSRF_TOKEN }),
      3600,
    )
  })

  it('returns 503 when no store is available', async () => {
    const response = await callGet()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body).toEqual({ error: 'CSRF token could not be issued' })
  })
})

/**
 * The store-backed `X-CSRF-Token` path above is the only CSRF mechanism.
 *
 * A cookie double-submit middleware used to live in
 * `apps/web/src/lib/middleware/csrf.ts` with zero importers. It was deleted as
 * dead code superseded by the store; this guard fails if it, or any other
 * unwired CSRF middleware, is wired back into the request pipeline.
 */
describe('CSRF mechanism ownership', () => {
  const repoRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../../../../..',
  )

  it('has no second, unwired cookie double-submit middleware', () => {
    expect(
      existsSync(path.join(repoRoot, 'apps/web/src/lib/middleware/csrf.ts')),
    ).toBe(false)

    const middleware = readFileSync(
      path.join(repoRoot, 'apps/web/src/middleware.ts'),
      'utf8',
    )
    expect(middleware).not.toMatch(/lib\/middleware\/csrf|csrfMiddleware/)
  })
})
