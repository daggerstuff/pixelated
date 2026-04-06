// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  MemoryServiceRequestSigner,
  resolveInternalMemoryServiceConfig,
} from '@/lib/server/internal-memory-service-auth'

const ORIGINAL_ENV = { ...process.env }

describe('resolveInternalMemoryServiceConfig', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
    vi.restoreAllMocks()
  })

  it('prefers MEMORY_SERVICE_* variables when present', () => {
    process.env.MEMORY_SERVICE_BASE_URL = 'http://memory.internal:54321'
    process.env.MEMORY_SERVICE_ACTOR_ID = 'product-gateway'
    process.env.MEMORY_SERVICE_ACTOR_SECRET = 'top-secret'
    process.env.MEMORY_SERVICE_TIMEOUT_MS = '9000'
    process.env.SUBCONSCIOUS_MEMORY_BASE_URL = 'http://ignored'
    process.env.SUBCONSCIOUS_MEMORY_ACTOR_ID = 'ignored-id'
    process.env.SUBCONSCIOUS_MEMORY_ACTOR_SECRET = 'ignored-secret'

    expect(resolveInternalMemoryServiceConfig()).toEqual({
      baseUrl: 'http://memory.internal:54321',
      actorId: 'product-gateway',
      actorSecret: 'top-secret',
      timeoutMs: 9000,
    })
  })

  it('falls back to SUBCONSCIOUS_MEMORY_* variables', () => {
    delete process.env.MEMORY_SERVICE_BASE_URL
    delete process.env.MEMORY_SERVICE_ACTOR_ID
    delete process.env.MEMORY_SERVICE_ACTOR_SECRET
    delete process.env.MEMORY_SERVICE_TIMEOUT_MS
    process.env.SUBCONSCIOUS_MEMORY_BASE_URL = 'http://subconscious.internal:54321'
    process.env.SUBCONSCIOUS_MEMORY_ACTOR_ID = 'subconscious-gateway'
    process.env.SUBCONSCIOUS_MEMORY_ACTOR_SECRET = 'subconscious-secret'

    expect(resolveInternalMemoryServiceConfig()).toEqual({
      baseUrl: 'http://subconscious.internal:54321',
      actorId: 'subconscious-gateway',
      actorSecret: 'subconscious-secret',
      timeoutMs: 5000,
    })
  })

  it('fails fast when the actor id is missing', () => {
    delete process.env.MEMORY_SERVICE_ACTOR_ID
    delete process.env.SUBCONSCIOUS_MEMORY_ACTOR_ID
    process.env.MEMORY_SERVICE_ACTOR_SECRET = 'secret'

    expect(() => resolveInternalMemoryServiceConfig()).toThrow(
      /MEMORY_SERVICE_ACTOR_ID or SUBCONSCIOUS_MEMORY_ACTOR_ID is required/,
    )
  })

  it('fails fast when the actor secret is missing', () => {
    process.env.MEMORY_SERVICE_ACTOR_ID = 'product-gateway'
    delete process.env.MEMORY_SERVICE_ACTOR_SECRET
    delete process.env.SUBCONSCIOUS_MEMORY_ACTOR_SECRET

    expect(() => resolveInternalMemoryServiceConfig()).toThrow(
      /MEMORY_SERVICE_ACTOR_SECRET or SUBCONSCIOUS_MEMORY_ACTOR_SECRET is required/,
    )
  })
})

describe('MemoryServiceRequestSigner', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('signs requests with product gateway headers', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T00:00:00.000Z'))
    vi.spyOn(Math, 'random').mockReturnValue(0.5)

    const signer = new MemoryServiceRequestSigner('product-gateway', 'secret')
    const headers = signer.signedHeaders({
      method: 'POST',
      target: '/api/memory/search?limit=5',
      userId: 'vivi',
      body: '{"query":"hello"}',
    })

    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['X-Memory-Actor-Id']).toBe('product-gateway')
    expect(headers['X-Memory-User-Id']).toBe('vivi')
    expect(headers['X-Memory-Timestamp']).toBe('1775433600')
    expect(headers['X-Memory-Nonce']).toMatch(/^[a-f0-9]{32}$/)
    expect(headers['X-Memory-Signature']).toMatch(/^[a-f0-9]{64}$/)
  })
})
