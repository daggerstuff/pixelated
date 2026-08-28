import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

vi.mock('../tracing/arize-setup', () => ({ initArizeTracing: vi.fn(), getArizeTracer: vi.fn() }))
vi.mock('../datasets/prepare-fine-tuning', () => ({}))
vi.mock('../datasets/merge-datasets', () => ({}))

import {
  initializeProviders,
  getAIServiceByProvider,
  getAvailableProviders,
  isProviderAvailable,
  getProviderConfig,
  resetProvidersForTesting,
  setProviderForTesting,
  createChatCompletionWithFallback,
  createStreamingChatCompletionWithFallback,
  type AIProviderType,
  type AIProviderConfig,
} from '../providers'
import {
  TokenBucketRateLimiter,
  RateLimitError,
  acquireRateLimit,
  tryAcquireRateLimit,
  getRateLimiter,
  resetAllRateLimiters,
  createRateLimiter,
} from '../rate-limiter'
import {
  isRetryableError,
  buildFallbackChain,
  executeWithFallback,
  executeStreamingWithFallback,
  ProviderError,
  type ServiceResolver,
} from '../fallback'
import type { AIMessage, AICompletion, AIStreamChunk, AIService } from '../models/ai-types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(provider: AIProviderType, apiKey: string, baseUrl = 'https://test.example.com'): AIProviderConfig {
  return {
    name: provider,
    baseUrl,
    apiKey,
    defaultModel: 'test-model',
    capabilities: ['chat'],
  }
}

function mockFetchResponse(body: unknown, status = 200, ok = true): Response {
  return {
    ok,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
    text: async () => JSON.stringify(body),
    body: null,
  } as Response
}

function mockStreamResponse(chunks: Array<{ data: string }>): Response {
  const encoder = new TextEncoder()
  const lines = chunks.map((c) => `data: ${JSON.stringify(c)}\n`)
  lines.push('data: [DONE]\n')
  const fullText = lines.join('')
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(fullText))
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    body: stream,
    json: async () => ({}),
    text: async () => '',
  } as Response
}

function makeMockService(provider: string, completion: AICompletion): AIService {
  return {
    createChatCompletion: vi.fn().mockResolvedValue(completion),
    createStreamingChatCompletion: vi.fn().mockResolvedValue(
      (async function* (): AsyncGenerator<AIStreamChunk, void, void> {
        yield { id: completion.id, model: completion.model, created: completion.created, content: completion.content, done: false }
        yield { id: completion.id, model: completion.model, created: completion.created, content: '', done: true, finishReason: 'stop' }
      })(),
    ),
    getModelInfo: () => ({
      id: 'mock',
      name: 'mock',
      provider,
      capabilities: ['chat'],
      contextWindow: 4096,
      maxTokens: 4096,
    }),
    dispose: vi.fn(),
  }
}

function makeCompletion(provider: string, content = 'test response'): AICompletion {
  return {
    id: `test-${provider}-${Date.now()}`,
    created: Date.now(),
    model: 'test-model',
    choices: [{ message: { role: 'assistant', content }, finishReason: 'stop' }],
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    provider,
    content,
  }
}

// ---------------------------------------------------------------------------
// Rate Limiter Tests
// ---------------------------------------------------------------------------

describe('TokenBucketRateLimiter', () => {
  it('allows requests up to capacity', () => {
    const limiter = new TokenBucketRateLimiter('test', {
      capacity: 3,
      refillRatePerMs: 0.001,
      maxWaitMs: 1000,
    })
    expect(limiter.tryAcquire()).toBe(true)
    expect(limiter.tryAcquire()).toBe(true)
    expect(limiter.tryAcquire()).toBe(true)
    expect(limiter.tryAcquire()).toBe(false)
  })

  it('refills tokens over time', async () => {
    const limiter = new TokenBucketRateLimiter('test', {
      capacity: 1,
      refillRatePerMs: 100, // 1 token per 10ms
      maxWaitMs: 1000,
    })
    expect(limiter.tryAcquire()).toBe(true)
    expect(limiter.tryAcquire()).toBe(false)
    await new Promise((r) => setTimeout(r, 15))
    expect(limiter.tryAcquire()).toBe(true)
  })

  it('acquire waits for token availability', async () => {
    const limiter = new TokenBucketRateLimiter('test', {
      capacity: 1,
      refillRatePerMs: 100, // 1 token per 10ms
      maxWaitMs: 5000,
    })
    expect(limiter.tryAcquire()).toBe(true)
    // acquire should wait and succeed
    await expect(limiter.acquire()).resolves.toBeUndefined()
  })

  it('throws RateLimitError when maxWaitMs exceeded', async () => {
    const limiter = new TokenBucketRateLimiter('test', {
      capacity: 1,
      refillRatePerMs: 0.0001, // very slow refill
      maxWaitMs: 50,
    })
    expect(limiter.tryAcquire()).toBe(true)
    await expect(limiter.acquire()).rejects.toThrow(RateLimitError)
  })

  it('reset restores full capacity', () => {
    const limiter = new TokenBucketRateLimiter('test', {
      capacity: 5,
      refillRatePerMs: 0.001,
      maxWaitMs: 1000,
    })
    for (let i = 0; i < 5; i++) limiter.tryAcquire()
    expect(limiter.availableTokens).toBe(0)
    limiter.reset()
    expect(limiter.availableTokens).toBe(5)
  })
})

describe('Rate limiter registry', () => {
  beforeEach(() => {
    resetAllRateLimiters()
  })

  it('createRateLimiter sets explicit config', () => {
    const limiter = createRateLimiter('test-custom', { requestsPerMinute: 120, burst: 10 })
    expect(limiter.availableTokens).toBe(10)
  })

  it('tryAcquireRateLimit returns boolean', () => {
    createRateLimiter('test-try', { requestsPerMinute: 2, burst: 1 })
    expect(tryAcquireRateLimit('test-try')).toBe(true)
    expect(tryAcquireRateLimit('test-try')).toBe(false)
  })

  it('acquireRateLimit resolves when tokens available', async () => {
    createRateLimiter('test-acquire', { requestsPerMinute: 60, burst: 5 })
    await expect(acquireRateLimit('test-acquire')).resolves.toBeUndefined()
  })

  it('acquireRateLimit rejects when wait exceeds maxWaitMs', async () => {
    createRateLimiter('test-reject', {
      requestsPerMinute: 1,
      burst: 1,
      maxWaitMs: 50,
    })
    await acquireRateLimit('test-reject') // drain the one token
    await expect(acquireRateLimit('test-reject')).rejects.toThrow(RateLimitError)
  })
})

// ---------------------------------------------------------------------------
// Fallback Tests
// ---------------------------------------------------------------------------

describe('isRetryableError', () => {
  it('returns true for 429 errors', () => {
    expect(isRetryableError(new Error('API error (429): Too many requests'))).toBe(true)
  })

  it('returns true for 5xx errors', () => {
    expect(isRetryableError(new Error('API error (503): Service unavailable'))).toBe(true)
  })

  it('returns true for network errors', () => {
    expect(isRetryableError(new Error('fetch failed: ECONNRESET'))).toBe(true)
    expect(isRetryableError(new Error('ETIMEDOUT'))).toBe(true)
  })

  it('returns true for RateLimitError', () => {
    expect(isRetryableError(new RateLimitError('limit', 'test', 1000))).toBe(true)
  })

  it('returns true for unknown errors (safe default)', () => {
    expect(isRetryableError(new Error('something weird'))).toBe(true)
  })
})

describe('buildFallbackChain', () => {
  it('places primary first, then available providers', () => {
    const chain = buildFallbackChain('anthropic', ['anthropic', 'openai', 'huggingface'])
    expect(chain).toEqual(['anthropic', 'openai', 'huggingface'])
  })

  it('excludes primary from subsequent positions', () => {
    const chain = buildFallbackChain('openai', ['anthropic', 'openai', 'huggingface'])
    expect(chain).toEqual(['openai', 'anthropic', 'huggingface'])
  })

  it('handles primary not in available list', () => {
    const chain = buildFallbackChain('llm', ['anthropic', 'openai'])
    expect(chain).toEqual(['llm', 'anthropic', 'openai'])
  })
})

describe('executeWithFallback', () => {
  it('succeeds on first provider without fallback', async () => {
    const completion = makeCompletion('anthropic')
    const svc = makeMockService('anthropic', completion)
    const resolver: ServiceResolver = (p) => (p === 'anthropic' ? svc : null)
    const result = await executeWithFallback(resolver, { providers: ['anthropic', 'openai'] }, [])
    expect(result).toBe(completion)
    expect(svc.createChatCompletion).toHaveBeenCalledTimes(1)
  })

  it('falls over to next provider on failure', async () => {
    const failSvc: AIService = {
      createChatCompletion: vi.fn().mockRejectedValue(new Error('503 Service Unavailable')),
      createStreamingChatCompletion: vi.fn(),
      getModelInfo: vi.fn(),
      dispose: vi.fn(),
    }
    const okCompletion = makeCompletion('openai')
    const okSvc = makeMockService('openai', okCompletion)
    const resolver: ServiceResolver = (p) => {
      if (p === 'anthropic') return failSvc
      if (p === 'openai') return okSvc
      return null
    }
    const result = await executeWithFallback(
      resolver,
      { providers: ['anthropic', 'openai'], maxRetries: 0 },
      [],
    )
    expect(result).toBe(okCompletion)
  })

  it('retries within a provider before falling over', async () => {
    const callCount = { value: 0 }
    const completion = makeCompletion('anthropic')
    const svc: AIService = {
      createChatCompletion: vi.fn().mockImplementation(async () => {
        callCount.value++
        if (callCount.value < 3) throw new Error('503 Temporarily Unavailable')
        return completion
      }),
      createStreamingChatCompletion: vi.fn(),
      getModelInfo: vi.fn(),
      dispose: vi.fn(),
    }
    const resolver: ServiceResolver = (p) => (p === 'anthropic' ? svc : null)
    const result = await executeWithFallback(
      resolver,
      { providers: ['anthropic'], maxRetries: 3, initialBackoffMs: 1, maxBackoffMs: 10 },
      [],
    )
    expect(result).toBe(completion)
    expect(svc.createChatCompletion).toHaveBeenCalledTimes(3)
  })

  it('throws ProviderError when all providers exhausted', async () => {
    const failSvc: AIService = {
      createChatCompletion: vi.fn().mockRejectedValue(new Error('500 Internal Server Error')),
      createStreamingChatCompletion: vi.fn(),
      getModelInfo: vi.fn(),
      dispose: vi.fn(),
    }
    const resolver: ServiceResolver = () => failSvc
    await expect(
      executeWithFallback(resolver, { providers: ['anthropic', 'openai'], maxRetries: 0 }, []),
    ).rejects.toThrow(ProviderError)
  })

  it('skips unavailable providers', async () => {
    const completion = makeCompletion('openai')
    const svc = makeMockService('openai', completion)
    const resolver: ServiceResolver = (p) => (p === 'openai' ? svc : null)
    const result = await executeWithFallback(
      resolver,
      { providers: ['anthropic', 'openai', 'huggingface'] },
      [],
    )
    expect(result).toBe(completion)
  })
})

describe('executeStreamingWithFallback', () => {
  it('returns first chunk then delegates to rest of stream', async () => {
    const chunks: AIStreamChunk[] = [
      { id: 's1', model: 'test', created: Date.now(), content: 'hello', done: false },
      { id: 's1', model: 'test', created: Date.now(), content: ' world', done: true, finishReason: 'stop' },
    ]
    const svc: AIService = {
      createChatCompletion: vi.fn(),
      createStreamingChatCompletion: vi.fn().mockResolvedValue(
        (async function* (): AsyncGenerator<AIStreamChunk, void, void> {
          for (const c of chunks) yield c
        })(),
      ),
      getModelInfo: vi.fn(),
      dispose: vi.fn(),
    }
    const resolver: ServiceResolver = (p) => (p === 'anthropic' ? svc : null)
    const stream = await executeStreamingWithFallback(resolver, { providers: ['anthropic'] }, [])
    const collected: string[] = []
    for await (const chunk of stream) {
      collected.push(chunk.content)
    }
    expect(collected).toEqual(['hello', ' world'])
  })

  it('falls over when stream throws on first chunk', async () => {
    const failSvc: AIService = {
      createChatCompletion: vi.fn(),
      createStreamingChatCompletion: vi.fn().mockRejectedValue(new Error('500 Server Error')),
      getModelInfo: vi.fn(),
      dispose: vi.fn(),
    }
    const okChunks: AIStreamChunk[] = [
      { id: 'ok1', model: 'test', created: Date.now(), content: 'ok', done: true, finishReason: 'stop' },
    ]
    const okSvc: AIService = {
      createChatCompletion: vi.fn(),
      createStreamingChatCompletion: vi.fn().mockResolvedValue(
        (async function* (): AsyncGenerator<AIStreamChunk, void, void> {
          for (const c of okChunks) yield c
        })(),
      ),
      getModelInfo: vi.fn(),
      dispose: vi.fn(),
    }
    const resolver: ServiceResolver = (p) => {
      if (p === 'anthropic') return failSvc
      if (p === 'openai') return okSvc
      return null
    }
    const stream = await executeStreamingWithFallback(
      resolver,
      { providers: ['anthropic', 'openai'], maxRetries: 0 },
      [],
    )
    const collected: string[] = []
    for await (const chunk of stream) collected.push(chunk.content)
    expect(collected).toEqual(['ok'])
  })
})

// ---------------------------------------------------------------------------
// Provider Integration Tests (with mocked fetch)
// ---------------------------------------------------------------------------

describe('Provider adapters with mocked fetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    resetProvidersForTesting()
    resetAllRateLimiters()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('Anthropic adapter: successful completion', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        id: 'msg-123',
        content: [{ text: 'Hello!', type: 'text' }],
        usage: { input_tokens: 5, output_tokens: 3 },
        stop_reason: 'end_turn',
      }),
    )
    setProviderForTesting('anthropic', makeConfig('anthropic', 'test-key'))
    const svc = getAIServiceByProvider('anthropic')
    expect(svc).not.toBeNull()
    const messages: AIMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ]
    const result = await svc!.createChatCompletion(messages)
    expect(result.provider).toBe('anthropic')
    expect(result.content).toBe('Hello!')
    expect(result.usage.promptTokens).toBe(5)
    expect(result.usage.completionTokens).toBe(3)
    expect(result.choices[0].message.content).toBe('Hello!')
  })

  it('Anthropic adapter: extracts system message from messages', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        id: 'msg-456',
        content: [{ text: 'ok', type: 'text' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      }),
    )
    setProviderForTesting('anthropic', makeConfig('anthropic', 'test-key'))
    const svc = getAIServiceByProvider('anthropic')
    const messages: AIMessage[] = [
      { role: 'system', content: 'System prompt' },
      { role: 'user', content: 'Hello' },
    ]
    await svc!.createChatCompletion(messages)
    const callBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(callBody.system).toBe('System prompt')
    expect(callBody.messages).toEqual([{ role: 'user', content: 'Hello' }])
  })

  it('Anthropic adapter: throws on error status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({ error: 'Invalid key' }, 401, false),
    )
    setProviderForTesting('anthropic', makeConfig('anthropic', 'bad-key'))
    const svc = getAIServiceByProvider('anthropic')
    await expect(svc!.createChatCompletion([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      /Anthropic API error \(401\)/,
    )
  })

  it('OpenAI adapter: successful completion', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        id: 'chat-123',
        created: 1700000000,
        model: 'gpt-4',
        choices: [{ message: { role: 'assistant', content: 'Hi there' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }),
    )
    setProviderForTesting('openai', makeConfig('openai', 'sk-test'))
    const svc = getAIServiceByProvider('openai')
    const result = await svc!.createChatCompletion([{ role: 'user', content: 'hello' }])
    expect(result.provider).toBe('openai')
    expect(result.content).toBe('Hi there')
    expect(result.usage.totalTokens).toBe(15)
  })

  it('OpenAI adapter: sends Bearer auth header', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        id: 'c1',
        created: 1,
        model: 'gpt-4',
        choices: [{ message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    )
    setProviderForTesting('openai', makeConfig('openai', 'sk-secret'))
    const svc = getAIServiceByProvider('openai')
    await svc!.createChatCompletion([{ role: 'user', content: 'hi' }])
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer sk-secret')
  })

  it('OpenAI adapter: throws on error status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({ error: 'Forbidden' }, 403, false),
    )
    setProviderForTesting('openai', makeConfig('openai', 'bad'))
    const svc = getAIServiceByProvider('openai')
    await expect(svc!.createChatCompletion([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      /OpenAI API error \(403\)/,
    )
  })

  it('HuggingFace adapter: successful completion', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse([{ generated_text: 'HF response' }]),
    )
    setProviderForTesting('huggingface', makeConfig('huggingface', 'hf-key'))
    const svc = getAIServiceByProvider('huggingface')
    const result = await svc!.createChatCompletion([{ role: 'user', content: 'hi' }])
    expect(result.provider).toBe('huggingface')
    expect(result.content).toBe('HF response')
    expect(result.usage.totalTokens).toBeGreaterThan(0)
  })

  it('HuggingFace adapter: formats prompt with role labels', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(mockFetchResponse([{ generated_text: 'ok' }]))
    setProviderForTesting('huggingface', makeConfig('huggingface', 'hf-key'))
    const svc = getAIServiceByProvider('huggingface')
    const messages: AIMessage[] = [
      { role: 'system', content: 'Be nice' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ]
    await svc!.createChatCompletion(messages)
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string)
    expect(body.inputs).toContain('System: Be nice')
    expect(body.inputs).toContain('User: Hello')
    expect(body.inputs).toContain('Assistant: Hi')
  })

  it('Local adapter: successful completion', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        id: 'local-1',
        choices: [{ message: { content: 'local response' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    )
    setProviderForTesting('local', makeConfig('local', 'local-no-key', 'http://localhost:8000/v1'))
    const svc = getAIServiceByProvider('local')
    const result = await svc!.createChatCompletion([{ role: 'user', content: 'hi' }])
    expect(result.content).toBe('local response')
  })

  it('Local adapter: throws on empty response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({ id: 'x', choices: [{ message: {} }] }),
    )
    setProviderForTesting('local', makeConfig('local', 'local-no-key'))
    const svc = getAIServiceByProvider('local')
    await expect(svc!.createChatCompletion([{ role: 'user', content: 'hi' }])).rejects.toThrow(
      /empty or malformed/,
    )
  })
})

// ---------------------------------------------------------------------------
// Streaming Tests
// ---------------------------------------------------------------------------

describe('Streaming adapters', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    resetProvidersForTesting()
    resetAllRateLimiters()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('OpenAI adapter: streams content chunks', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockStreamResponse([
        { id: 's1', model: 'gpt-4', created: 1, choices: [{ delta: { content: 'Hello' } }] },
        { id: 's1', model: 'gpt-4', created: 1, choices: [{ delta: { content: ' world' } }] },
        { id: 's1', model: 'gpt-4', created: 1, choices: [{ finish_reason: 'stop' }] },
      ]),
    )
    setProviderForTesting('openai', makeConfig('openai', 'sk-test'))
    const svc = getAIServiceByProvider('openai')
    const stream = await svc!.createStreamingChatCompletion([{ role: 'user', content: 'hi' }])
    const chunks: string[] = []
    for await (const chunk of stream) {
      chunks.push(chunk.content)
    }
    expect(chunks).toEqual(['Hello', ' world', ''])
  })

  it('Anthropic adapter: streams content_block_delta events', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockStreamResponse([
        { type: 'content_block_delta', delta: { text: 'Claude' }, message: { id: 'm1' } },
        { type: 'content_block_delta', delta: { text: ' says hi' }, message: { id: 'm1' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
      ]),
    )
    setProviderForTesting('anthropic', makeConfig('anthropic', 'test-key'))
    const svc = getAIServiceByProvider('anthropic')
    const stream = await svc!.createStreamingChatCompletion([{ role: 'user', content: 'hi' }])
    const chunks: string[] = []
    for await (const chunk of stream) {
      chunks.push(chunk.content)
    }
    expect(chunks).toContain('Claude')
    expect(chunks).toContain(' says hi')
  })

  it('HuggingFace adapter: streams token events', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockStreamResponse([
        { token: { text: 'HF' } },
        { token: { text: ' streaming' } },
      ]),
    )
    setProviderForTesting('huggingface', makeConfig('huggingface', 'hf-key'))
    const svc = getAIServiceByProvider('huggingface')
    const stream = await svc!.createStreamingChatCompletion([{ role: 'user', content: 'hi' }])
    const chunks: string[] = []
    for await (const chunk of stream) {
      chunks.push(chunk.content)
    }
    expect(chunks).toContain('HF')
    expect(chunks).toContain(' streaming')
  })
})

// ---------------------------------------------------------------------------
// Provider Registry Tests
// ---------------------------------------------------------------------------

describe('Provider registry', () => {
  beforeEach(() => {
    resetProvidersForTesting()
    resetAllRateLimiters()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('isProviderAvailable returns false for unconfigured provider', () => {
    expect(isProviderAvailable('anthropic')).toBe(false)
  })

  it('isProviderAvailable returns true after setProviderForTesting', () => {
    setProviderForTesting('openai', makeConfig('openai', 'key'))
    expect(isProviderAvailable('openai')).toBe(true)
  })

  it('getAvailableProviders returns configured providers', () => {
    setProviderForTesting('anthropic', makeConfig('anthropic', 'key'))
    setProviderForTesting('openai', makeConfig('openai', 'key'))
    const available = getAvailableProviders()
    expect(available).toContain('anthropic')
    expect(available).toContain('openai')
  })

  it('getProviderConfig returns config for configured provider', () => {
    const config = makeConfig('anthropic', 'test-key')
    setProviderForTesting('anthropic', config)
    const result = getProviderConfig('anthropic')
    expect(result).toEqual(config)
  })

  it('getProviderConfig returns null for unconfigured provider', () => {
    expect(getProviderConfig('nvidia')).toBeNull()
  })

  it('getAIServiceByProvider returns null for unconfigured provider', () => {
    expect(getAIServiceByProvider('anthropic')).toBeNull()
  })

  it('initializeProviders reads env vars', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'env-key')
    vi.stubEnv('OPENAI_API_KEY', 'openai-key')
    initializeProviders()
    expect(isProviderAvailable('anthropic')).toBe(true)
    expect(isProviderAvailable('openai')).toBe(true)
    expect(getProviderConfig('anthropic')?.apiKey).toBe('env-key')
  })

  it('local provider always initialized with default URL', () => {
    initializeProviders()
    expect(isProviderAvailable('local')).toBe(true)
    expect(getProviderConfig('local')?.baseUrl).toBe('http://localhost:8000/v1')
  })
})

// ---------------------------------------------------------------------------
// Fallback Integration Tests
// ---------------------------------------------------------------------------

describe('Fallback integration with providers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    resetProvidersForTesting()
    resetAllRateLimiters()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('createChatCompletionWithFallback succeeds with primary', async () => {
    vi.mocked(fetch).mockResolvedValue(
      mockFetchResponse({
        id: 'fb-1',
        created: 1,
        model: 'gpt-4',
        choices: [{ message: { role: 'assistant', content: 'fallback ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    )
    setProviderForTesting('openai', makeConfig('openai', 'key'))
    setProviderForTesting('anthropic', makeConfig('anthropic', 'key'))
    const result = await createChatCompletionWithFallback('openai', [{ role: 'user', content: 'hi' }])
    expect(result.content).toBe('fallback ok')
  })

  it('createChatCompletionWithFallback falls over when primary fails', async () => {
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      // OpenAI endpoint returns 500
      if (url.includes('openai.com') || url.includes('api.openai.com')) {
        return mockFetchResponse({ error: 'fail' }, 500, false)
      }
      // Anthropic endpoint returns success
      return mockFetchResponse({
        id: 'fb-2',
        created: 1,
        model: 'claude-3',
        content: [{ text: 'from anthropic', type: 'text' }],
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: 'end_turn',
      })
    })
    setProviderForTesting('openai', makeConfig('openai', 'key', 'https://api.openai.com'))
    setProviderForTesting('anthropic', makeConfig('anthropic', 'key', 'https://api.anthropic.com'))
    const result = await createChatCompletionWithFallback('openai', [{ role: 'user', content: 'hi' }], { maxRetries: 0 })
    expect(result.provider).toBe('anthropic')
    expect(result.content).toBe('from anthropic')
  })
})
