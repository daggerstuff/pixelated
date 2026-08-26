import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLLMService } from '../llm-provider'

vi.mock('../tracing/arize-setup', () => ({
  getArizeTracer: () => ({
    startActiveSpan: (
      _name: string,
      fn: (span: unknown) => unknown,
    ) => fn({ span: {} }),
    startSpan: () => ({
      end: () => {},
      setAttribute: () => {},
      recordException: () => {},
    }),
  }),
}))

vi.mock('../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }),
}))

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('createLLMService retry behavior', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(200, { choices: [] })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const runService = async (failureResponses: Response[]) => {
    const fetchMock = vi.mocked(globalThis.fetch)
    failureResponses.forEach((r) => fetchMock.mockResolvedValueOnce(r))
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        id: 'chatcmpl-test',
        choices: [{ message: { role: 'assistant', content: 'ok' } }],
      }),
    )

    const service = createLLMService({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test-key',
      timeoutMs: 1000,
    })

    const run = service.createChatCompletion(
      [{ role: 'user', content: 'hello' }],
      { model: 'test-model', temperature: 0 },
    )

    // Advance past backoff delays and in-flight timer/AbortController waits.
    for (let i = 0; i < 12; i++) {
      await vi.advanceTimersByTimeAsync(40_000)
    }
    const result = await run
    service.dispose()
    return { result, calls: fetchMock.mock.calls.length }
  }

  it('retries transient 5xx responses and succeeds on retry', async () => {
    const { result, calls } = await runService([
      jsonResponse(503, { error: { message: 'overloaded', code: 'server_overloaded' } }),
      jsonResponse(502, { error: { message: 'bad gateway' } }),
    ])

    expect(result.content).toBe('ok')
    // Initial attempt + 2 retries
    expect(calls).toBe(3)
  })

  it('treats 408 timeouts as transient and retries', async () => {
    const { result, calls } = await runService([
      jsonResponse(408, { error: { message: 'request timeout' } }),
    ])

    expect(result.content).toBe('ok')
    expect(calls).toBe(2)
  })

  it('does not retry non-retryable 4xx errors', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: { message: 'invalid api key' } }),
    )

    const service = createLLMService({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'bad-key',
      timeoutMs: 1000,
    })

    const run = service.createChatCompletion(
      [{ role: 'user', content: 'hello' }],
      { model: 'test-model', temperature: 0 },
    )

    await expect(run).rejects.toThrow()
    service.dispose()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws after exhausting retries on persistent 5xx', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockResolvedValue(
      jsonResponse(503, { error: { message: 'overloaded' } }),
    )

    const service = createLLMService({
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test-key',
      timeoutMs: 1000,
    })

    const run = service.createChatCompletion(
      [{ role: 'user', content: 'hello' }],
      { model: 'test-model', temperature: 0 },
    )

    let failure: unknown
    const timers = (async () => {
      for (let i = 0; i < 12; i++) {
        await vi.advanceTimersByTimeAsync(40_000)
      }
    })()
    try {
      await run
    } catch (error) {
      failure = error
    }
    await timers

    expect(failure).toBeInstanceOf(Error)
    service.dispose()
    // maxRetries=3 → 4 total attempts
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})
