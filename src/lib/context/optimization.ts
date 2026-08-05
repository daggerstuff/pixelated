/**
 * Context optimization architecture for Pixelated agents.
 *
 * This module provides primitives to reduce the context-window footprint of
 * agent startup and runtime:
 *
 * - Token estimation and context-budget tracking
 * - Lazy-loading wrappers for heavy MCP connections
 * - Hub-and-spoke rule loading for agent instructions
 * - Startup profiling so we can measure rather than guess
 *
 * @module @/lib/context/optimization
 */

/**
 * Configuration shape for an MCP client connection. Mirrors the fields accepted
 * by `defineMcpClientConnection` from the `eve` framework so that lazy
 * wrappers can be dropped in without changing call sites.
 */
export interface McpConnectionConfig {
  url: string
  description?: string
  headers?: Record<string, string>
  auth?: {
    getToken: () => Promise<{ token: string }>
  }
}

/**
 * A handle to a lazily initialized resource.
 */
export interface LazyConnection<T> {
  /** Returns the underlying resource, initializing it on first call. */
  get: () => Promise<T>
  /** True if the resource has already been initialized. */
  isLoaded: () => boolean
  /** Drops the cached resource so the next `get()` re-initializes. */
  unload: () => Promise<void>
  /**
   * Gracefully shut down the resource if it has a `close()` method, then
   * unload it. Awaits any in-flight factory so a still-connecting MCP client
   * is captured and closed rather than leaked.
   */
  close: () => Promise<void>
}

/**
 * A set of rules organized as a central hub plus agent/topic spokes.
 */
export interface RuleSet {
  hub: string
  spokes: string[]
}

/**
 * Snapshot of context consumption at a point in time.
 */
export interface ContextProfile {
  timestamp: string
  totalTokens: number
  totalMs?: number
  components: Record<string, { tokens: number; ms: number }>
}

/**
 * Rough token estimator for English text and code.
 *
 * Uses a conservative ~4 characters per token. This is intentionally simple;
 * it is meant for budgeting and profiling, not billing.
 */
export function estimateTokens(text: string | null | undefined): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

/**
 * Tracks consumption against a fixed context-window budget.
 */
export class ContextBudget {
  private used = 0

  constructor(
    private readonly maxTokens: number,
    private readonly thresholdPercent = 0.8,
  ) {}

  /** Record that `tokens` were consumed. */
  consume(tokens: number): void {
    this.used += Math.max(0, tokens)
  }

  /** Record consumption by estimating tokens from a text fragment. */
  consumeText(text: string | null | undefined): void {
    this.consume(estimateTokens(text))
  }

  /** Remaining tokens before the budget is exhausted. */
  remaining(): number {
    return Math.max(0, this.maxTokens - this.used)
  }

  /** True if consumption has crossed the warning threshold. */
  isOverThreshold(): boolean {
    return this.used >= this.maxTokens * this.thresholdPercent
  }

  /** Current usage as a percentage of the total budget. */
  usagePercent(): number {
    if (this.maxTokens <= 0) return 0
    return (this.used / this.maxTokens) * 100
  }

  /** Reset consumption to zero. */
  reset(): void {
    this.used = 0
  }

  /** Current consumed tokens. */
  get usedTokens(): number {
    return this.used
  }
}

/**
 * Creates a lazy wrapper around any resource factory.
 *
 * The factory is not invoked until `get()` is called for the first time. This
 * keeps optional, heavy resources out of the startup context window and
 * avoids establishing network connections that may never be used.
 */
export function createLazyResource<T>(
  factory: () => T | Promise<T>,
): LazyConnection<T> {
  let cached: T | undefined
  let loading: Promise<T> | undefined
  let loadGeneration = 0
  let closing = false

  const closeIfCloseable = async (resource: T): Promise<void> => {
    if (
      resource != null &&
      typeof (resource as { close?: unknown }).close === 'function'
    ) {
      await (resource as unknown as { close: () => Promise<void> }).close()
    }
  }

  return {
    isLoaded: () => cached !== undefined,
    get: async () => {
      if (closing) throw new Error('Resource is closing')
      if (cached !== undefined) return cached
      if (loading !== undefined) return loading

      const gen = ++loadGeneration
      const promise = Promise.resolve(factory())
        .then((resource) => {
          if (loadGeneration !== gen) {
            void closeIfCloseable(resource)
            return resource
          }
          cached = resource
          return resource
        })
        .catch((err) => {
          if (loadGeneration === gen) {
            loading = undefined
          }
          throw err
        })
        .finally(() => {
          if (loadGeneration === gen) {
            loading = undefined
          }
        })

      loading = promise
      return loading
    },
    unload: async () => {
      cached = undefined
      loadGeneration++
      const currentLoading = loading
      loading = undefined
      if (currentLoading) {
        try {
          await currentLoading
        } catch {
          // ignore errors from the discarded load
        }
      }
    },
    close: async () => {
      if (closing) return
      closing = true

      let resource: T | undefined
      if (loading) {
        try {
          resource = await loading
        } catch {
          // Factory failed — nothing to close.
        }
      }
      resource ??= cached

      if (resource) {
        await closeIfCloseable(resource)
      }

      cached = undefined
      loading = undefined
      loadGeneration++
    },
  }
}

/**
 * Creates a lazy wrapper around an MCP connection factory.
 *
 * The factory is not invoked until `get()` is called for the first time. This
 * keeps optional, heavy tool groups out of the startup context window and
 * avoids establishing network connections that may never be used.
 */
export function createLazyMcpConnection<T extends McpConnectionConfig>(
  factory: () => T | Promise<T>,
): LazyConnection<T> {
  return createLazyResource(factory)
}

/**
 * Composes a hub-and-spoke rule document.
 *
 * The hub contains shared rules that every agent must follow. Each spoke
 * contains agent-specific or topic-specific guidance. The resulting string can
 * be used as an agent instruction body.
 */
export function loadHubAndSpokeRules(hub: string, spokes: string[]): string {
  const parts = [`# Hub Rules\n\n${hub.trim()}`]

  for (const [index, spoke] of spokes.entries()) {
    if (!spoke.trim()) continue
    parts.push(`# Spoke ${index + 1}\n\n${spoke.trim()}`)
  }

  return parts.join('\n\n---\n\n')
}

/**
 * Profiles startup context consumption by component.
 *
 * Use this during agent initialization to identify which instructions,
 * connections, or tool groups dominate the context window.
 */
export class StartupProfiler {
  private readonly startTime: number
  private readonly components = new Map<
    string,
    { tokens: number; ms: number }
  >()

  constructor() {
    this.startTime = performance.now()
  }

  /** Profile a synchronous initialization step. */
  profile<T>(label: string, fn: () => T): T {
    const t0 = performance.now()
    const result = fn()
    const ms = performance.now() - t0
    const tokens = typeof result === 'string' ? estimateTokens(result) : 0
    this.record(label, tokens, ms)
    return result
  }

  /** Profile an asynchronous initialization step. */
  async profileAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const t0 = performance.now()
    try {
      const result = await fn()
      const tokens = typeof result === 'string' ? estimateTokens(result) : 0
      this.record(label, tokens, performance.now() - t0)
      return result
    } catch (error) {
      this.record(label, 0, performance.now() - t0)
      throw error
    }
  }

  /** Profile a static text fragment (e.g. instructions, connection descriptions). */
  profileText(label: string, text: string | null | undefined): number {
    const tokens = estimateTokens(text)
    this.record(label, tokens, 0)
    return tokens
  }

  private record(label: string, tokens: number, ms: number): void {
    const existing = this.components.get(label)
    if (existing) {
      this.components.set(label, {
        tokens: existing.tokens + tokens,
        ms: existing.ms + ms,
      })
    } else {
      this.components.set(label, { tokens, ms })
    }
  }

  /** Return a snapshot of current context consumption. */
  report(): ContextProfile {
    let totalTokens = 0
    const componentRecord: Record<string, { tokens: number; ms: number }> = {}

    for (const [label, { tokens, ms }] of this.components.entries()) {
      totalTokens += tokens
      componentRecord[label] = { tokens, ms }
    }

    return {
      timestamp: new Date().toISOString(),
      totalTokens,
      totalMs: this.elapsedMs(),
      components: componentRecord,
    }
  }

  /** Elapsed milliseconds since the profiler was created. */
  elapsedMs(): number {
    return performance.now() - this.startTime
  }
}

/**
 * Creates a lazy wrapper around an MCP client factory that includes getClient() and close() methods.
 * Safely handles closing the client even if close() is called while the factory is still resolving.
 */
export function createLazyMcpClient<T extends { close(): Promise<void> }>(
  factory: () => Promise<T>,
): {
  getClient: () => Promise<T>
  close: () => Promise<void>
} {
  const lazyClient = createLazyResource<T>(factory)

  return {
    getClient: async () => lazyClient.get(),
    close: async () => lazyClient.close(),
  }
}
