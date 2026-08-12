import { describe, expect, it, vi } from 'vitest'

import {
  ContextBudget,
  StartupProfiler,
  createLazyMcpConnection,
  createLazyResource,
  estimateTokens,
  loadHubAndSpokeRules,
} from '../optimization.js'

describe('estimateTokens', () => {
  it('returns 0 for empty input', () => {
    expect(estimateTokens('')).toBe(0)
    expect(estimateTokens(null)).toBe(0)
    expect(estimateTokens(undefined)).toBe(0)
  })

  it('estimates ~1 token per 4 characters', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcdefghijklmnop')).toBe(4)
  })

  it('returns at least 1 for non-empty strings', () => {
    expect(estimateTokens('a')).toBe(1)
  })
})

describe('ContextBudget', () => {
  it('tracks consumption and remaining budget', () => {
    const budget = new ContextBudget(1000)
    expect(budget.remaining()).toBe(1000)

    budget.consume(200)
    expect(budget.usedTokens).toBe(200)
    expect(budget.remaining()).toBe(800)
    expect(budget.usagePercent()).toBe(20)
  })

  it('reports when threshold is crossed', () => {
    const budget = new ContextBudget(1000, 0.75)
    budget.consume(700)
    expect(budget.isOverThreshold()).toBe(false)

    budget.consume(100)
    expect(budget.isOverThreshold()).toBe(true)
  })

  it('can be reset', () => {
    const budget = new ContextBudget(1000)
    budget.consume(500)
    budget.reset()
    expect(budget.usedTokens).toBe(0)
    expect(budget.remaining()).toBe(1000)
  })

  it('estimates text consumption', () => {
    const budget = new ContextBudget(1000)
    budget.consumeText('this is a test string')
    expect(budget.usedTokens).toBe(estimateTokens('this is a test string'))
  })
})

describe('createLazyMcpConnection', () => {
  it('does not call the factory until get() is invoked', () => {
    const factory = vi.fn(() => ({ url: 'http://example.com/mcp' }))
    const lazy = createLazyMcpConnection(factory)

    expect(lazy.isLoaded()).toBe(false)
    expect(factory).not.toHaveBeenCalled()
  })

  it('calls the factory once and caches the result', async () => {
    const factory = vi.fn(() => ({ url: 'http://example.com/mcp' }))
    const lazy = createLazyMcpConnection(factory)

    const first = await lazy.get()
    const second = await lazy.get()

    expect(factory).toHaveBeenCalledTimes(1)
    expect(first).toBe(second)
    expect(lazy.isLoaded()).toBe(true)
  })

  it('supports async factories', async () => {
    const factory = vi.fn(async () => ({ url: 'http://example.com/mcp' }))
    const lazy = createLazyMcpConnection(factory)

    const connection = await lazy.get()
    expect(connection.url).toBe('http://example.com/mcp')
  })

  it('coalesces concurrent get() calls', async () => {
    const factory = vi.fn(async () => ({ url: 'http://example.com/mcp' }))
    const lazy = createLazyMcpConnection(factory)

    const [a, b] = await Promise.all([lazy.get(), lazy.get()])
    expect(factory).toHaveBeenCalledTimes(1)
    expect(a).toBe(b)
  })

  it('can be unloaded and reloaded', async () => {
    const factory = vi.fn(() => ({ url: 'http://example.com/mcp' }))
    const lazy = createLazyMcpConnection(factory)

    await lazy.get()
    await lazy.unload()

    expect(lazy.isLoaded()).toBe(false)

    await lazy.get()
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('clears loading state on factory rejection, allowing retry', async () => {
    let callCount = 0
    const factory = vi.fn(async () => {
      callCount++
      if (callCount === 1) throw new Error('transient failure')
      return { url: 'http://example.com/mcp' }
    })
    const lazy = createLazyMcpConnection(factory)

    await expect(lazy.get()).rejects.toThrow('transient failure')
    expect(lazy.isLoaded()).toBe(false)

    const result = await lazy.get()
    expect(result.url).toBe('http://example.com/mcp')
    expect(factory).toHaveBeenCalledTimes(2)
  })

  it('does not cache stale resource when unload() races an in-flight get()', async () => {
    let resolveFactory: (v: { url: string }) => void
    const factory = vi.fn(
      () =>
        new Promise<{ url: string }>((r) => {
          resolveFactory = r
        }),
    )
    const lazy = createLazyMcpConnection(factory)

    const getPromise = lazy.get()
    resolveFactory!({ url: 'http://stale.example.com/mcp' })
    await lazy.unload()

    const result = await getPromise
    expect(result.url).toBe('http://stale.example.com/mcp')
    expect(lazy.isLoaded()).toBe(false)
  })

  it('close() calls resource.close() when loaded', async () => {
    const mockClose = vi.fn().mockResolvedValue(undefined)
    const factory = vi.fn(() => ({
      url: 'http://example.com/mcp',
      close: mockClose,
    }))
    const lazy = createLazyResource(factory)

    await lazy.get()
    await lazy.close()

    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(lazy.isLoaded()).toBe(false)
  })

  it('close() awaits in-flight factory and closes the resource', async () => {
    const mockClose = vi.fn().mockResolvedValue(undefined)
    let resolveFactory: (v: { url: string; close: typeof mockClose }) => void
    const factory = vi.fn(
      () =>
        new Promise<{ url: string; close: typeof mockClose }>((r) => {
          resolveFactory = r
        }),
    )
    const lazy = createLazyResource(factory)

    const getPromise = lazy.get()
    const closePromise = lazy.close()

    resolveFactory!({ url: 'http://example.com/mcp', close: mockClose })

    await Promise.all([getPromise, closePromise])

    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(lazy.isLoaded()).toBe(false)
  })

  it('close() does nothing when no resource exists', async () => {
    const factory = vi.fn(() => ({ url: 'http://example.com/mcp' }))
    const lazy = createLazyResource(factory)

    await lazy.close()

    expect(factory).not.toHaveBeenCalled()
    expect(lazy.isLoaded()).toBe(false)
  })

  it('close() is idempotent', async () => {
    const mockClose = vi.fn().mockResolvedValue(undefined)
    const factory = vi.fn(() => ({
      url: 'http://example.com/mcp',
      close: mockClose,
    }))
    const lazy = createLazyResource(factory)

    await lazy.get()
    await lazy.close()
    await lazy.close()

    expect(mockClose).toHaveBeenCalledTimes(1)
  })

  it('close() closes stale resources from prior generation', async () => {
    const mockClose = vi.fn().mockResolvedValue(undefined)
    let resolveFactory: (v: { url: string; close: typeof mockClose }) => void
    const factory = vi.fn(
      () =>
        new Promise<{ url: string; close: typeof mockClose }>((r) => {
          resolveFactory = r
        }),
    )
    const lazy = createLazyResource(factory)

    const getPromise = lazy.get()
    const unloadPromise = lazy.unload()

    resolveFactory!({ url: 'http://stale.example.com/mcp', close: mockClose })

    await Promise.all([getPromise, unloadPromise])

    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(lazy.isLoaded()).toBe(false)
  })

  it('get() throws after close() is called', async () => {
    const mockClose = vi.fn().mockResolvedValue(undefined)
    const factory = vi.fn(() => ({
      url: 'http://example.com/mcp',
      close: mockClose,
    }))
    const lazy = createLazyResource(factory)

    await lazy.get()
    const closePromise = lazy.close()

    await expect(lazy.get()).rejects.toThrow('Resource is closing')
    await closePromise
  })
})

describe('loadHubAndSpokeRules', () => {
  it('combines hub and spokes with separators', () => {
    const result = loadHubAndSpokeRules('Shared rule.', [
      'Agent rule A.',
      'Agent rule B.',
    ])

    expect(result).toContain('# Hub Rules')
    expect(result).toContain('Shared rule.')
    expect(result).toContain('# Spoke 1')
    expect(result).toContain('Agent rule A.')
    expect(result).toContain('# Spoke 2')
    expect(result).toContain('Agent rule B.')
    expect(result).toContain('---')
  })

  it('skips empty spokes', () => {
    const result = loadHubAndSpokeRules('Hub.', ['', 'Only this spoke.'])
    expect(result).not.toContain('# Spoke 1')
    expect(result).toContain('# Spoke 2')
  })
})

describe('StartupProfiler', () => {
  it('profiles synchronous steps', () => {
    const profiler = new StartupProfiler()
    const text = profiler.profile('instructions', () => 'hello world')

    expect(text).toBe('hello world')
    const report = profiler.report()
    expect(report.components['instructions'].tokens).toBe(
      estimateTokens('hello world'),
    )
    expect(report.totalTokens).toBe(report.components['instructions'].tokens)
  })

  it('profiles asynchronous steps', async () => {
    const profiler = new StartupProfiler()
    await profiler.profileAsync('connection', async () => 'lazy connection')

    const report = profiler.report()
    expect(report.components['connection'].tokens).toBe(
      estimateTokens('lazy connection'),
    )
  })

  it('profiles static text fragments', () => {
    const profiler = new StartupProfiler()
    profiler.profileText('instructions', 'hello world')

    const report = profiler.report()
    expect(report.components['instructions'].tokens).toBe(
      estimateTokens('hello world'),
    )
    expect(report.totalTokens).toBe(report.components['instructions'].tokens)
  })

  it('aggregates repeated labels', () => {
    const profiler = new StartupProfiler()
    profiler.profile('step', () => 'a')
    profiler.profile('step', () => 'b')

    const report = profiler.report()
    expect(report.components['step'].tokens).toBe(
      estimateTokens('a') + estimateTokens('b'),
    )
  })

  it('records elapsed time', () => {
    vi.useFakeTimers()
    const profiler = new StartupProfiler()
    vi.advanceTimersByTime(100)
    expect(profiler.elapsedMs()).toBe(100)
    vi.useRealTimers()
  })
})
