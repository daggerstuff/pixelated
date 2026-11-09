/* @vitest-environment node */
/**
 * CSRF store unit tests.
 *
 * Covers the three ordered backends: the Cloudflare KV binding, the existing
 * Redis cache fallback, and the unavailable store when neither exists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CSRF_KV_BINDING,
  CSRF_TOKEN_TTL_SECONDS,
  type CsrfCacheBackend,
  type CsrfKvNamespace,
  type CsrfTokenRecord,
  createCsrfStore,
  resolveCsrfStore,
} from '../csrf-store'

interface FakeKv extends CsrfKvNamespace {
  entries: Map<string, { value: string; expiresAt: number | null }>
  puts: Array<{ key: string; value: string; expirationTtl?: number }>
}

function createFakeKv(clock: () => number): FakeKv {
  const entries = new Map<
    string,
    { value: string; expiresAt: number | null }
  >()
  const puts: Array<{ key: string; value: string; expirationTtl?: number }> = []

  return {
    entries,
    puts,
    async get(key: string) {
      const entry = entries.get(key)
      if (!entry) return null
      if (entry.expiresAt !== null && entry.expiresAt <= clock()) return null
      return entry.value
    },
    async put(
      key: string,
      value: string,
      options?: { expirationTtl?: number },
    ) {
      puts.push({ key, value, expirationTtl: options?.expirationTtl })
      entries.set(key, {
        value,
        expiresAt:
          options?.expirationTtl === undefined
            ? null
            : clock() + options.expirationTtl * 1000,
      })
    },
    async delete(key: string) {
      entries.delete(key)
    },
  }
}

function createFakeCache(): CsrfCacheBackend & {
  values: Map<string, unknown>
  sets: Array<{ key: string; value: unknown; ttlSeconds?: number }>
} {
  const values = new Map<string, unknown>()
  const sets: Array<{ key: string; value: unknown; ttlSeconds?: number }> = []

  return {
    values,
    sets,
    async get<T>(key: string) {
      return (values.get(key) as T | undefined) ?? null
    },
    async set(key: string, value: unknown, ttlSeconds?: number) {
      sets.push({ key, value, ttlSeconds })
      values.set(key, value)
      return true
    },
  }
}

describe('csrf-store', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('documents a one-hour token lifetime', () => {
    expect(CSRF_TOKEN_TTL_SECONDS).toBe(3600)
    expect(CSRF_KV_BINDING).toBe('CSRF_TOKENS')
  })

  describe('KV backend', () => {
    it('writes the token under csrf:<token> with the one-hour expiry and reads it back', async () => {
      const now = 1_700_000_000_000
      const kv = createFakeKv(() => now)
      const store = createCsrfStore({ kv })
      const record: CsrfTokenRecord = { token: 'a'.repeat(64), expiresAt: now + 3_600_000 }

      expect(store.kind).toBe('kv')
      await expect(store.store(record.token, record)).resolves.toBe(true)

      expect(kv.puts).toEqual([
        {
          key: `csrf:${record.token}`,
          value: JSON.stringify(record),
          expirationTtl: 3600,
        },
      ])
      await expect(store.load(record.token)).resolves.toEqual(record)
    })

    it('expires the token when the documented TTL elapses', async () => {
      let now = 1_700_000_000_000
      const kv = createFakeKv(() => now)
      const store = createCsrfStore({ kv })
      const record: CsrfTokenRecord = { token: 'b'.repeat(64), expiresAt: now + 3_600_000 }

      await store.store(record.token, record, CSRF_TOKEN_TTL_SECONDS)
      await expect(store.load(record.token)).resolves.toEqual(record)

      now += CSRF_TOKEN_TTL_SECONDS * 1000 + 1

      await expect(store.load(record.token)).resolves.toBeNull()
    })

    it('returns null for a malformed KV payload instead of throwing', async () => {
      const kv = createFakeKv(() => 0)
      await kv.put('csrf:broken', 'not-json')
      const store = createCsrfStore({ kv })

      await expect(store.load('broken')).resolves.toBeNull()
    })

    it('reports a failed write when the binding rejects the put', async () => {
      const kv: CsrfKvNamespace = {
        get: async () => null,
        put: async () => {
          throw new Error('kv unavailable')
        },
      }
      const store = createCsrfStore({ kv })

      await expect(
        store.store('c'.repeat(64), { token: 'c'.repeat(64), expiresAt: 1 }),
      ).resolves.toBe(false)
    })
  })

  describe('Redis fallback', () => {
    it('uses the existing cache helpers when no KV binding is present', async () => {
      const cache = createFakeCache()
      const store = createCsrfStore({ kv: null, cache })
      const record: CsrfTokenRecord = { token: 'd'.repeat(64), expiresAt: 1_700_000_000_000 }

      expect(store.kind).toBe('redis')
      await expect(store.store(record.token, record)).resolves.toBe(true)
      expect(cache.sets).toEqual([
        { key: `csrf:${record.token}`, value: record, ttlSeconds: 3600 },
      ])
      await expect(store.load(record.token)).resolves.toEqual(record)
    })

    it('treats a cache write failure as an unavailable store', async () => {
      const cache: CsrfCacheBackend = {
        get: async () => null,
        set: async () => false,
      }
      const store = createCsrfStore({ kv: null, cache })

      await expect(
        store.store('e'.repeat(64), { token: 'e'.repeat(64), expiresAt: 1 }),
      ).resolves.toBe(false)
    })
  })

  describe('no-store path', () => {
    it('reports unavailable when neither a KV binding nor a cache exists', async () => {
      const store = createCsrfStore({ kv: null, cache: null })

      expect(store.kind).toBe('unavailable')
      await expect(
        store.store('f'.repeat(64), { token: 'f'.repeat(64), expiresAt: 1 }),
      ).resolves.toBe(false)
      await expect(store.load('f'.repeat(64))).resolves.toBeNull()
    })
  })

  describe('binding resolution', () => {
    it('prefers the KV binding exposed on the adapter runtime env in locals', async () => {
      const kv = createFakeKv(() => 0)
      const store = await resolveCsrfStore({
        runtime: { env: { [CSRF_KV_BINDING]: kv } },
      })

      expect(store.kind).toBe('kv')
      await store.store('g'.repeat(64), {
        token: 'g'.repeat(64),
        expiresAt: 1,
      })
      expect(kv.puts).toHaveLength(1)
    })

    it('falls back to the Redis cache when the runtime env has no binding', async () => {
      const store = await resolveCsrfStore({ runtime: { env: {} } })

      expect(store.kind).toBe('redis')
    })

    it('ignores a bare global and keeps the Redis fallback outside the Worker', async () => {
      const kv = createFakeKv(() => 0)
      const globalWithBinding = globalThis as Record<string, unknown>
      globalWithBinding[CSRF_KV_BINDING] = kv

      try {
        const store = await resolveCsrfStore()
        expect(store.kind).toBe('redis')
        expect(kv.puts).toHaveLength(0)
      } finally {
        delete globalWithBinding[CSRF_KV_BINDING]
      }
    })
  })
})
