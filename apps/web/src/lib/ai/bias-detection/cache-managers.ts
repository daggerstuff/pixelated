/**
 * Bias-detection cache managers and public wrappers.
 * Extracted from cache.ts.
 */

import { BiasDetectionCache, logger } from './cache.base'
import type { CacheConfig } from './cache.base'
import type {
  CacheStats,
  BiasReport,
  BiasAnalysisResult,
  TherapeuticSession,
  ParticipantDemographics,
  DashboardData,
} from './types'

export class BiasAnalysisCache {
  private readonly cache: BiasDetectionCache

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new BiasDetectionCache({
      maxSize: 500,
      defaultTtl: 60 * 60 * 1000, // 1 hour
      ...config,
    })
  }

  /**
   * Cache bias analysis result
   */
  async cacheAnalysisResult(
    sessionId: string,
    result: BiasAnalysisResult,
  ): Promise<void> {
    const key = `analysis:${sessionId}`
    const tags = [
      'bias-analysis',
      `session:${sessionId}`,
      `alert:${result.alertLevel}`,
    ]

    await this.cache.set(key, result, {
      tags,
      ttl: 2 * 60 * 60 * 1000, // 2 hours for analysis results
    })
  }

  /**
   * Get cached analysis result
   */
  async getAnalysisResult(
    sessionId: string,
  ): Promise<BiasAnalysisResult | null> {
    const key = `analysis:${sessionId}`
    return await this.cache.get<BiasAnalysisResult>(key)
  }

  /**
   * Cache session data for quick access
   */
  async cacheSession(session: TherapeuticSession): Promise<void> {
    const key = `session:${session.sessionId}`
    const tags = [
      'session-data',
      `participant:${session.participantDemographics?.age ?? 'unknown'}:${session.participantDemographics?.gender ?? 'unknown'}`,
      `scenario:${session.scenario?.type ?? 'unknown'}`,
    ]

    await this.cache.set(key, session, { tags })
  }

  /**
   * Get cached session
   */
  async getSession(sessionId: string): Promise<TherapeuticSession | null> {
    const key = `session:${sessionId}`
    return await this.cache.get<TherapeuticSession>(key)
  }

  /**
   * Invalidate analysis results for specific demographics
   */
  async invalidateByDemographics(
    demographics: Partial<ParticipantDemographics>,
  ): Promise<number> {
    const tags: string[] = []

    // Match the tag format used in cacheSession: "participant:age:gender"
    if (demographics['age'] && demographics['gender']) {
      tags.push(`participant:${demographics['age']}:${demographics['gender']}`)
    }
    if (demographics['age'] && demographics['ethnicity']) {
      tags.push(`participant:${demographics['age']}:${demographics['ethnicity']}`)
    }
    if (demographics['gender'] && demographics['ethnicity']) {
      tags.push(`participant:${demographics['gender']}:${demographics['ethnicity']}`)
    }

    // Also support partial matches by checking if any tag contains the demographic value
    let invalidated = 0

    // Invalidate in-memory cache
    for (const [key, entry] of this.cache.getMemoryCacheEntries()) {
      if (entry?.tags) {
        let shouldInvalidate = false
        for (const tag of entry.tags) {
          if (tag.startsWith('participant:')) {
            const parts = tag.split(':')
            if (parts.length >= 2) {
              if (demographics['age'] && parts.includes(demographics['age'])) {
                shouldInvalidate = true
              }
              if (demographics['gender'] && parts.includes(demographics['gender'])) {
                shouldInvalidate = true
              }
              if (
                demographics['ethnicity'] &&
                parts.includes(demographics['ethnicity'])
              ) {
                shouldInvalidate = true
              }
            }
          }
        }
        if (shouldInvalidate) {
          await this.cache.delete(key)
          invalidated++
        }
      }
    }

    // Invalidate in Redis
    if (this.cache.isRedisConfigured()) {
      try {
        const keys = await this.cache.getRedisKeys()
        for (const redisKey of keys) {
          const cached = await this.cache.getFromRedisCache(redisKey)
          if (!cached) {
            continue
          }
          let cacheData: { tags?: string[] }
          try {
            cacheData = JSON.parse(cached) as { tags?: string[] }
          } catch {
            continue
          }
          if (cacheData.tags) {
            let shouldInvalidate = false
            for (const tag of cacheData.tags) {
              if (tag.startsWith('participant:')) {
                const parts = tag.split(':')
                if (parts.length >= 2) {
                  if (demographics['age'] && parts.includes(demographics['age'])) {
                    shouldInvalidate = true
                  }
                  if (
                    demographics['gender'] &&
                    parts.includes(demographics['gender'])
                  ) {
                    shouldInvalidate = true
                  }
                  if (
                    demographics['ethnicity'] &&
                    parts.includes(demographics['ethnicity'])
                  ) {
                    shouldInvalidate = true
                  }
                }
              }
            }
            if (shouldInvalidate) {
              await this.cache.deleteFromRedisCache(redisKey)
              invalidated++
            }
          }
        }
      } catch {
        // log error if needed
      }
    }

    return invalidated
  }

  getStats(): CacheStats {
    return this.cache.getStats()
  }

  async destroy(): Promise<void> {
    await this.cache.destroy()
  }
}

/**
 * Cache manager for dashboard data
 */
export class DashboardCache {
  private readonly cache: BiasDetectionCache

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new BiasDetectionCache({
      maxSize: 100,
      defaultTtl: 5 * 60 * 1000, // 5 minutes for dashboard data
      ...config,
    })
  }

  /**
   * Cache dashboard data
   */
  async cacheDashboardData(
    userId: string,
    timeRange: string,
    data: DashboardData,
  ): Promise<void> {
    const key = `dashboard:${userId}:${timeRange}`
    const tags = ['dashboard', `user:${userId}`, `timerange:${timeRange}`]

    await this.cache.set(key, data, { tags })
  }

  /**
   * Get cached dashboard data
   */
  async getDashboardData(
    userId: string,
    timeRange: string,
  ): Promise<DashboardData | null> {
    const key = `dashboard:${userId}:${timeRange}`
    return await this.cache.get<DashboardData>(key)
  }

  /**
   * Invalidate dashboard data for user
   */
  async invalidateUserDashboard(userId: string): Promise<number> {
    return await this.cache.invalidateByTags([`user:${userId}`])
  }

  /**
   * Invalidate all dashboard data
   */
  async invalidateAllDashboards(): Promise<number> {
    return await this.cache.invalidateByTags(['dashboard'])
  }

  getStats(): CacheStats {
    return this.cache.getStats()
  }

  async destroy(): Promise<void> {
    await this.cache.destroy()
  }
}

/**
 * Cache manager for reports
 */
export class ReportCache {
  private readonly cache: BiasDetectionCache

  constructor(config?: Partial<CacheConfig>) {
    this.cache = new BiasDetectionCache({
      maxSize: 50,
      defaultTtl: 24 * 60 * 60 * 1000, // 24 hours for reports
      ...config,
    })
  }

  /**
   * Cache report
   */
  async cacheReport(reportId: string, report: BiasReport): Promise<void> {
    const key = `report:${reportId}`
    const tags = ['report', `report:${reportId}`]

    await this.cache.set(key, report, {
      tags,
      ttl: 7 * 24 * 60 * 60 * 1000, // 7 days for reports
    })
  }

  /**
   * Get cached report
   */
  async getReport(reportId: string): Promise<BiasReport | null> {
    const key = `report:${reportId}`
    return await this.cache.get<BiasReport>(key)
  }

  /**
   * Invalidate specific report
   */
  async invalidateReport(reportId: string): Promise<number> {
    return await this.cache.invalidateByTags([`report:${reportId}`])
  }

  getStats(): CacheStats {
    return this.cache.getStats()
  }

  async destroy(): Promise<void> {
    await this.cache.destroy()
  }
}

// =============================================================================
// CACHE MANAGER SINGLETON
// =============================================================================

export class CacheManager {
  private static instance: CacheManager | null

  public readonly analysisCache: BiasAnalysisCache
  public readonly dashboardCache: DashboardCache
  public readonly reportCache: ReportCache

  private constructor() {
    this.analysisCache = new BiasAnalysisCache()
    this.dashboardCache = new DashboardCache()
    this.reportCache = new ReportCache()

    logger.info('CacheManager initialized')
  }

  static getInstance(): CacheManager {
    CacheManager.instance ??= new CacheManager();
    return CacheManager.instance
  }

  /**
   * Get combined cache statistics
   */
  getCombinedStats(): {
    analysis: CacheStats
    dashboard: CacheStats
    report: CacheStats
    total: {
      totalEntries: number
      totalMemoryUsage: number
      averageHitRate: number
    }
  } {
    const analysisStats = this.analysisCache.getStats()
    const dashboardStats = this.dashboardCache.getStats()
    const reportStats = this.reportCache.getStats()

    return {
      analysis: analysisStats,
      dashboard: dashboardStats,
      report: reportStats,
      total: {
        totalEntries:
          analysisStats.totalEntries +
          dashboardStats.totalEntries +
          reportStats.totalEntries,
        totalMemoryUsage:
          analysisStats.memoryUsage +
          dashboardStats.memoryUsage +
          reportStats.memoryUsage,
        averageHitRate:
          (analysisStats.hitRate +
            dashboardStats.hitRate +
            reportStats.hitRate) /
          3,
      },
    }
  }

  /**
   * Clear all caches
   */
  async clearAll(): Promise<void> {
    await this.analysisCache.destroy()
    await this.dashboardCache.destroy()
    await this.reportCache.destroy()
    logger.info('All caches cleared')
  }

  /**
   * Destroy cache manager
   */
  async destroy(): Promise<void> {
    await this.analysisCache.destroy()
    await this.dashboardCache.destroy()
    await this.reportCache.destroy()
    CacheManager.instance = null
    logger.info('CacheManager destroyed')
  }
}

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

/**
 * Get the global cache manager instance
 */
export function getCacheManager(): CacheManager {
  return CacheManager.getInstance()
}

/**
 * Reset cache manager (for testing)
 */
export async function resetCacheManager(): Promise<void> {
  const instance = CacheManager.getInstance()
  if (instance) {
    await instance.destroy()
  }
}
/**
 * Cache a bias analysis result
 */
export async function cacheAnalysisResult(
  sessionId: string,
  result: BiasAnalysisResult,
): Promise<void> {
  const cacheManager = getCacheManager()
  await cacheManager.analysisCache.cacheAnalysisResult(sessionId, result)
}

/**
 * Get cached bias analysis result
 */
export async function getCachedAnalysisResult(
  sessionId: string,
): Promise<BiasAnalysisResult | null> {
  const cacheManager = getCacheManager()
  return await cacheManager.analysisCache.getAnalysisResult(sessionId)
}

/**
 * Cache dashboard data
 */
export async function cacheDashboardData(
  userId: string,
  timeRange: string,
  data: DashboardData,
): Promise<void> {
  const cacheManager = getCacheManager()
  await cacheManager.dashboardCache.cacheDashboardData(userId, timeRange, data)
}

/**
 * Get cached dashboard data
 */
export async function getCachedDashboardData(
  userId: string,
  timeRange: string,
): Promise<DashboardData | null> {
  const cacheManager = getCacheManager()
  return await cacheManager.dashboardCache.getDashboardData(userId, timeRange)
}

/**
 * Cache a report
 */
export async function cacheReport(
  reportId: string,
  report: BiasReport,
): Promise<void> {
  const cacheManager = getCacheManager()
  await cacheManager.reportCache.cacheReport(reportId, report)
}

/**
 * Get cached report
 */
export async function getCachedReport(
  reportId: string,
): Promise<BiasReport | null> {
  const cacheManager = getCacheManager()
  return await cacheManager.reportCache.getReport(reportId)
}

