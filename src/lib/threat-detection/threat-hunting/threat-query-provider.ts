import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { IRedisClient, IMongoClient, HuntFinding } from './types'
import { runInParallelBatches } from '../../utils/concurrency'

const logger = createBuildSafeLogger('threat-query-provider')

/**
 * ThreatQueryProvider encapsulates cross-database query logic (Redis, MongoDB, Logs)
 * to reduce the complexity of the main ThreatHuntingService orchestrator.
 */
export class ThreatQueryProvider {
  // P4.2: TTL Cache for counts with size limit (max 100 entries)
  private searchCountCache = new Map<
    string,
    { count: number; isCapped: boolean; expires: number }
  >()
  private readonly MAX_CACHE_SIZE = 100

  constructor(
    private redis: IRedisClient,
    private mongoClient: IMongoClient,
  ) {}

  /**
   * P4.3: Execute a complex hunt query across all data sources.
   */
  public async executeHuntQuery(
    query: Record<string, unknown>,
  ): Promise<HuntFinding[]> {
    try {
      const [redisFindings, mongoFindings, logFindings] = await Promise.all([
        this.queryRedis(query),
        this.queryMongo(query),
        this.queryLogs(query),
      ])

      return [...redisFindings, ...mongoFindings, ...logFindings]
    } catch (error) {
      logger.error('Hunt query failed:', { error })
      throw error
    }
  }

  public async queryRedis(
    query: Record<string, unknown>,
  ): Promise<HuntFinding[]> {
    try {
      const findings: HuntFinding[] = []
      const rawPattern = (query.patternMatch as string) || 'rate_limit:*'
      const sanitizedSuffix = rawPattern.replace(/[^a-zA-Z0-9:*_-]/g, '')
      const pattern = sanitizedSuffix.includes(':')
        ? sanitizedSuffix
        : `rate_limit:${sanitizedSuffix}`

      if (query.patternMatch || query.scanEnabled) {
        const [nextCursor, keys] = await this.redis.scan(
          '0',
          'MATCH',
          pattern,
          'COUNT',
          '100',
        )

        if (keys.length > 10) {
          findings.push({
            findingId: `redis_query_${Date.now()}`,
            type: 'suspicious_pattern',
            title: `Detected high volume of matching keys: ${pattern}`,
            description: `Found ${keys.length} keys matching the specified pattern.`,
            evidence: keys.slice(0, 5).map((k) => ({ key: k })),
            confidence: 0.7,
            severity: 'low',
            recommendedActions: ['investigate_key_source'],
            relatedEntities: keys,
          })
        }
      }
      return findings
    } catch (error) {
      logger.error('queryRedis failed:', { error })
      return []
    }
  }

  public async queryMongo(
    query: Record<string, unknown>,
  ): Promise<HuntFinding[]> {
    return []
  }

  public async queryLogs(
    query: Record<string, unknown>,
  ): Promise<HuntFinding[]> {
    return []
  }

  /**
   * P4.1: Memory-efficient threat data search with security hardening and TTL caching.
   * Modularized into sub-methods to reduce cognitive complexity.
   */
  public async searchThreatData(
    searchData: Record<string, unknown>,
  ): Promise<{
    data: any[]
    pagination: {
      total: number
      page: number
      limit: number
      isCapped: boolean
      processingLimit: number
    }
  }> {
    const pagination =
      (searchData.pagination as { page?: number; limit?: number }) || {}
    const { page = 1, limit = 50 } = pagination
    const skip = (page - 1) * limit

    // P3.1 SECURITY FIX: Sanitize input and strictly prefix with 'threat:'.
    const rawPattern = (searchData.patternMatch as string) || '*'
    const sanitizedSuffix = rawPattern.replace(/[^a-zA-Z0-9:*_-]/g, '')
    const pattern = `threat:${sanitizedSuffix}`

    this.pruneCache()

    const { matchedKeys, totalCount, isCapped } = await this.discoverKeys(
      pattern,
      skip,
      limit,
    )
    const data = await this.hydrateFindings(matchedKeys)

    return {
      data,
      pagination: {
        total: totalCount,
        page,
        limit,
        isCapped,
        processingLimit: 10000,
      },
    }
  }

  /**
   * P4.1/P4.3: Discovers keys matching a pattern, using TTL cache for totals if available.
   * Ensures consistency between total count and matched keys.
   */
  private async discoverKeys(
    pattern: string,
    skip: number,
    limit: number,
  ): Promise<{ matchedKeys: string[]; totalCount: number; isCapped: boolean }> {
    const cacheKey = `count:${pattern}`
    const cached = this.searchCountCache.get(cacheKey)
    const now = Date.now()

    const useCache = Boolean(cached && cached.expires > now)
    if (useCache && skip >= cached!.count) {
      return {
        matchedKeys: [],
        totalCount: cached!.count,
        isCapped: cached!.isCapped,
      }
    }

    let cursor = '0'
    let seenCount = 0
    let totalCount = useCache ? cached!.count : 0
    let isCapped = useCache ? cached!.isCapped : false
    const matchedKeys: string[] = []

    try {
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          '500',
        )
        cursor = nextCursor

        for (const key of keys) {
          if (seenCount >= skip && matchedKeys.length < limit) {
            matchedKeys.push(key)
          }

          seenCount++

          if (!useCache) {
            totalCount++
            if (totalCount >= 10000) {
              isCapped = true
              break
            }
          }
        }

        if (useCache && seenCount >= skip + limit) break
        if (isCapped) break
      } while (cursor !== '0')

      if (!useCache) {
        this.searchCountCache.set(cacheKey, {
          count: totalCount,
          isCapped,
          expires: now + 60000,
        })
      }

      return { matchedKeys, totalCount, isCapped }
    } catch (error) {
      logger.error('discoverKeys failed:', { error, pattern })
      return { matchedKeys: [], totalCount: 0, isCapped: false }
    }
  }

  /**
   * P4.3: Hydrates finding data from Redis keys in batches to prevent event loop blocking.
   */
  private async hydrateFindings(keys: string[]): Promise<any[]> {
    if (keys.length === 0) return []

    const chunkSize = 50
    const chunks: string[][] = []

    // Split into chunks
    for (let i = 0; i < keys.length; i += chunkSize) {
      chunks.push(keys.slice(i, i + chunkSize))
    }

    // Use runInParallelBatches with concurrency limit to avoid resource exhaustion
    const results: string[] = []
    await runInParallelBatches(
      chunks,
      async (chunk) => {
        const chunkResults = await this.redis.mget(chunk)
        results.push(...chunkResults.filter((t): t is string => t !== null))
      },
      5 // Concurrency limit
    )

    return results
      .map((t) => {
        try {
          return JSON.parse(t)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  }

  /**
   * P4.2: Simple pruning mechanism to prevent memory leak in searchCountCache.
   */
  private pruneCache(): void {
    if (this.searchCountCache.size <= this.MAX_CACHE_SIZE) return

    const now = Date.now()
    this.searchCountCache.forEach((entry, key) => {
      if (entry.expires <= now) {
        this.searchCountCache.delete(key)
      }
    })

    // Force prune if still over size after TTL cleanup
    if (this.searchCountCache.size > this.MAX_CACHE_SIZE) {
      const iterable = this.searchCountCache.keys()
      const firstKey = iterable.next().value
      if (firstKey !== undefined) this.searchCountCache.delete(firstKey)
    }
  }
}
