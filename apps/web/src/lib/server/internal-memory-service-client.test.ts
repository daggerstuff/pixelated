// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import { InternalMemoryServiceClient } from './internal-memory-service-client'

type CapturedRequest = {
  url: string
  body: string
}

function createClient(): InternalMemoryServiceClient {
  return new InternalMemoryServiceClient({
    baseUrl: 'http://memory.internal:54321',
    actorId: 'product-gateway',
    actorSecret: 'secret',
    secrets: { current: 'secret' },
    timeoutMs: 1000,
  })
}

function stubFetch(payload: unknown): CapturedRequest[] {
  const captured: CapturedRequest[] = []
  vi.stubGlobal(
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      captured.push({
        url: input instanceof Request ? input.url : input.toString(),
        body: typeof init?.body === 'string' ? init.body : '',
      })
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  )
  return captured
}

function readBody(captured: CapturedRequest[]): Record<string, unknown> {
  return JSON.parse(captured[0]?.body ?? '{}') as Record<string, unknown>
}

describe('InternalMemoryServiceClient filter forwarding', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('sends every declared search filter in the request body', async () => {
    const captured = stubFetch({ memories: [], count: 0 })

    await createClient().searchMemories({
      userId: 'user-1',
      query: 'grief',
      limit: 5,
      offset: 10,
      category: 'fact',
      tags: ['a', 'b'],
      scope: 'session',
      retention: 'short_term',
    })

    expect(readBody(captured)).toMatchObject({
      user_id: 'user-1',
      query: 'grief',
      limit: 5,
      offset: 10,
      category: 'fact',
      tags: ['a', 'b'],
      scope: 'session',
      retention: 'short_term',
    })
  })

  it('defaults the search offset to zero', async () => {
    const captured = stubFetch({ memories: [], count: 0 })

    await createClient().searchMemories({
      userId: 'user-1',
      query: 'grief',
      limit: 5,
    })

    const body = readBody(captured)

    expect(body['offset']).toBe(0)
    expect(body['scope']).toBeUndefined()
    expect(body['retention']).toBeUndefined()
  })

  it('sends scope and retention as list query parameters', async () => {
    const captured = stubFetch({ memories: [], count: 0 })

    await createClient().listMemories({
      userId: 'user-1',
      limit: 20,
      offset: 40,
      scope: 'org',
      retention: 'long_term',
    })

    const url = new URL(captured[0]?.url ?? '')

    expect(url.searchParams.get('scope')).toBe('org')
    expect(url.searchParams.get('retention')).toBe('long_term')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('offset')).toBe('40')
  })

  it('omits scope and retention from the list query when unset', async () => {
    const captured = stubFetch({ memories: [], count: 0 })

    await createClient().listMemories({ userId: 'user-1', limit: 20 })

    const url = new URL(captured[0]?.url ?? '')

    expect(url.searchParams.has('scope')).toBe(false)
    expect(url.searchParams.has('retention')).toBe(false)
  })
})
