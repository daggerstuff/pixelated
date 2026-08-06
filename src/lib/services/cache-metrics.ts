import { createBuildSafeLogger } from '../logging/build-safe-logger'
import type { RedisClient } from './types/redis'

const logger = createBuildSafeLogger('cache-metrics')

/**
 * Per-prefix cache statistics entry.
 */
export interface PrefixStats {
  prefix: string
  hits: number
  misses: number
  totalRequests: number
  hitRatio: number
}

/**
 * Aggregated cache statistics returned to the dashboard.
 */
export interface CacheStats {
  overallHits: number
  overallMisses: number
  overallTotal: number
  overallHitRatio: number
  perPrefix: PrefixStats[]
  topMisses: { key: string; count: number }[]
  measuredAt: string
}

interface InternalCounters {
  hits: Map<string, number>
  misses: Map<string, number>
  keyMissCounts: Map<string, number>
}

/**
 * Cache Metrics Service
 *
 * Tracks cache hits and misses per key-prefix in memory. When a Redis client
 * is available, counters are also persisted via get/set so that metrics
 * survive process restarts and can be aggregated across instances.
 *
 * The service is intentionally dependency-light: it does not require INCR or
 * HINCRBY Redis commands. Instead it uses a read-modify-write cycle on a
 * dedicated metrics key, which works with the minimal RedisClient interface.
 */
export class CacheMetricsService {
  private readonly counters: InternalCounters = {
    hits: new Map(),
    misses: new Map(),
    keyMissCounts: new Map(),
  }

  private readonly redisKey = 'app:cache:metrics'
  private readonly maxTrackedKeys = 500

  constructor(private readonly redis: RedisClient | null = null) {}

  /**
   * Extract the prefix from a cache key.
   * Keys are expected to be in the format `prefix:rest` or `prefix:sub:rest`.
   * We extract the first colon-delimited segment as the prefix.
   */
  static extractPrefix(key: string): string {
    const idx = key.indexOf(':')
    return idx === -1 ? key : key.substring(0, idx)
  }

  /**
   * Record a cache hit for the given key.
   */
  recordHit(key: string): void {
    const prefix = CacheMetricsService.extractPrefix(key)
    this.counters.hits.set(prefix, (this.counters.hits.get(prefix) ?? 0) + 1)
  }

  /**
   * Record a cache miss for the given key.
   */
  recordMiss(key: string): void {
    const prefix = CacheMetricsService.extractPrefix(key)
    this.counters.misses.set(
      prefix,
      (this.counters.misses.get(prefix) ?? 0) + 1,
    )

    // Track individual key miss counts (for top-misses display)
    this.counters.keyMissCounts.set(
      key,
      (this.counters.keyMissCounts.get(key) ?? 0) + 1,
    )

    // Evict oldest tracked key if we exceed the limit
    if (this.counters.keyMissCounts.size > this.maxTrackedKeys) {
      const firstKey = this.counters.keyMissCounts.keys().next().value
      if (firstKey !== undefined) {
        this.counters.keyMissCounts.delete(firstKey)
      }
    }
  }

  /**
   * Get aggregated statistics for the dashboard.
   * When Redis is available, merges persisted counters with in-memory ones.
   */
  async getStats(): Promise<CacheStats> {
    let hitsMap = new Map(this.counters.hits)
    let missesMap = new Map(this.counters.misses)
    let keyMissCounts = new Map(this.counters.keyMissCounts)

    // Merge persisted counters from Redis if available
    if (this.redis) {
      try {
        const raw = await this.redis.get(this.redisKey)
        if (raw) {
          const persisted = JSON.parse(raw) as {
            hits: Record<string, number>
            misses: Record<string, number>
            keyMissCounts: Record<string, number>
          }
          for (const [k, v] of Object.entries(persisted.hits ?? {})) {
            hitsMap.set(k, (hitsMap.get(k) ?? 0) + v)
          }
          for (const [k, v] of Object.entries(persisted.misses ?? {})) {
            missesMap.set(k, (missesMap.get(k) ?? 0) + v)
          }
          for (const [k, v] of Object.entries(persisted.keyMissCounts ?? {})) {
            keyMissCounts.set(k, (keyMissCounts.get(k) ?? 0) + v)
          }
        }
      } catch (err) {
        logger.warn('Failed to read persisted cache metrics', { error: err })
      }
    }

    // Build per-prefix stats
    const allPrefixes = new Set([...hitsMap.keys(), ...missesMap.keys()])
    const perPrefix: PrefixStats[] = []

    let overallHits = 0
    let overallMisses = 0

    for (const prefix of allPrefixes) {
      const hits = hitsMap.get(prefix) ?? 0
      const misses = missesMap.get(prefix) ?? 0
      const total = hits + misses
      overallHits += hits
      overallMisses += misses
      perPrefix.push({
        prefix,
        hits,
        misses,
        totalRequests: total,
        hitRatio: total > 0 ? hits / total : 0,
      })
    }

    // Sort by total requests descending
    perPrefix.sort((a, b) => b.totalRequests - a.totalRequests)

    // Build top misses (top 20)
    const topMisses = Array.from(keyMissCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([key, count]) => ({ key, count }))

    const overallTotal = overallHits + overallMisses

    return {
      overallHits,
      overallMisses,
      overallTotal,
      overallHitRatio: overallTotal > 0 ? overallHits / overallTotal : 0,
      perPrefix,
      topMisses,
      measuredAt: new Date().toISOString(),
    }
  }

  /**
   * Persist current in-memory counters to Redis (best-effort).
   */
  async persist(): Promise<void> {
    if (!this.redis) return

    try {
      const data = {
        hits: Object.fromEntries(this.counters.hits),
        misses: Object.fromEntries(this.counters.misses),
        keyMissCounts: Object.fromEntries(this.counters.keyMissCounts),
      }
      await this.redis.set(this.redisKey, JSON.stringify(data), { ex: 86400 })
    } catch (err) {
      logger.warn('Failed to persist cache metrics', { error: err })
    }
  }

  /**
   * Reset all counters (for testing or manual reset).
   */
  reset(): void {
    this.counters.hits.clear()
    this.counters.misses.clear()
    this.counters.keyMissCounts.clear()
  }
}

// Singleton
let metricsInstance: CacheMetricsService | null = null

/**
 * Get the singleton CacheMetricsService instance.
 * Uses the provided Redis client if available, otherwise runs in-memory only.
 */
export function getCacheMetricsService(
  redis?: RedisClient | null,
): CacheMetricsService {
  metricsInstance ??= new CacheMetricsService(redis ?? null);
  return metricsInstance
}

/**
 * Reset the singleton (for testing only).
 */
export function resetCacheMetricsService(): void {
  metricsInstance = null
}
