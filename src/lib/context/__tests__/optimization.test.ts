import { describe, expect, it, vi } from 'vitest'

import {
  ContextBudget,
  StartupProfiler,
  createLazyMcpConnection,
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
})

describe('loadHubAndSpokeRules', () => {
  it('combines hub and spokes with separators', () => {
    const result = loadHubAndSpokeRules('Shared rule.', ['Agent rule A.', 'Agent rule B.'])

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
    expect(report.components.instructions).toBe(estimateTokens('hello world'))
    expect(report.totalTokens).toBe(report.components.instructions)
  })

  it('profiles asynchronous steps', async () => {
    const profiler = new StartupProfiler()
    await profiler.profileAsync('connection', async () => 'lazy connection')

    const report = profiler.report()
    expect(report.components.connection).toBe(estimateTokens('lazy connection'))
  })

  it('profiles static text fragments', () => {
    const profiler = new StartupProfiler()
    profiler.profileText('instructions', 'hello world')

    const report = profiler.report()
    expect(report.components.instructions).toBe(estimateTokens('hello world'))
    expect(report.totalTokens).toBe(report.components.instructions)
  })

  it('aggregates repeated labels', () => {
    const profiler = new StartupProfiler()
    profiler.profile('step', () => 'a')
    profiler.profile('step', () => 'b')

    const report = profiler.report()
    expect(report.components.step).toBe(
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
