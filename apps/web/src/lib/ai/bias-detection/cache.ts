/**
 * Caching Layer for Pixelated Empathy Bias Detection Engine.
 *
 * Public barrel — re-exports the base cache (BiasDetectionCache) and the
 * manager classes + wrappers. Implementation split across cache.base.ts
 * and cache-managers.ts.
 */

export { CacheConfig, CacheOptions, BiasDetectionCache } from './cache.base'
export {
  BiasAnalysisCache,
  DashboardCache,
  ReportCache,
  CacheManager,
  getCacheManager,
  resetCacheManager,
  cacheAnalysisResult,
  getCachedAnalysisResult,
  cacheDashboardData,
  getCachedDashboardData,
  cacheReport,
  getCachedReport,
} from './cache-managers'
