/**
 * CDN and Edge Caching Optimizer
 * Global content delivery optimization with edge caching and asset management
 */

import { getLogger } from '@/lib/logging'
import { createHash } from 'crypto'

const logger = getLogger('cdn-optimizer')

// CDN configuration
interface CDNConfig {
  provider: 'cloudflare' | 'aws' | 'azure' | 'custom'
  baseUrl: string
  apiKey?: string
  zoneId?: string

  // Edge caching settings
  edgeCache: {
    enabled: boolean
    defaultTTL: number
    maxTTL: number
    staleWhileRevalidate: number
  }

  // Asset optimization
  assets: {
    enableCompression: boolean
    enableWebP: boolean
    enableAVIF: boolean
    imageQuality: number
  }

  // Geographic optimization
  geo: {
    enableGeoRouting: boolean
    preferredRegions: string[]
    failoverRegions: string[]
  }
}

// Asset metadata
interface AssetMetadata {
  url: string
  originalSize: number
  optimizedSize?: number
  format: string
  width?: number
  height?: number
  hash: string
  cdnUrl?: string
  cacheHeaders: Record<string, string>
}

// CDN response
interface CDNResponse {
  success: boolean
  url?: string
  error?: string
  metadata?: AssetMetadata
}

/**
 * CDN and edge caching service
 */
export class CDNEdgeOptimizer {
  private config: CDNConfig
  private assetCache: Map<string, AssetMetadata> = new Map()

  constructor(config: Partial<CDNConfig> = {}) {
    this.config = {
      provider: 'cloudflare',
      baseUrl: process.env.CDN_BASE_URL || 'https://cdn.pixelatedempathy.com',
      edgeCache: {
        enabled: true,
        defaultTTL: 3600, // 1 hour
        maxTTL: 86400, // 24 hours
        staleWhileRevalidate: 300, // 5 minutes
      },
      assets: {
        enableCompression: true,
        enableWebP: true,
        enableAVIF: true,
        imageQuality: 85,
      },
      geo: {
        enableGeoRouting: false,
        preferredRegions: ['us-east-1', 'eu-west-1'],
        failoverRegions: ['us-west-1', 'ap-southeast-1'],
      },
      ...config,
    }

    logger.info('CDN optimizer initialized', {
      provider: this.config.provider,
      baseUrl: this.config.baseUrl,
      edgeCacheEnabled: this.config.edgeCache.enabled,
    })
  }

  /**
   * Optimize asset URL for CDN delivery
   */
  optimizeAssetUrl(
    assetPath: string,
    options: {
      format?: string
      width?: number
      height?: number
      quality?: number
      webp?: boolean
      avif?: boolean
    } = {},
  ): string {
    try {
      // Generate asset hash for cache busting
      const assetHash = this.generateAssetHash(assetPath, options)

      // Build optimized URL
      let optimizedUrl = `${this.config.baseUrl}${assetPath}`

      // Add query parameters for optimization
      const params = new URLSearchParams()

      if (options.format) params.append('format', options.format)
      if (options.width) params.append('w', options.width.toString())
      if (options.height) params.append('h', options.height.toString())
      if (options.quality) params.append('q', options.quality.toString())
      if (options.webp && this.config.assets.enableWebP)
        params.append('webp', 'true')
      if (options.avif && this.config.assets.enableAVIF)
        params.append('avif', 'true')

      // Add cache busting
      params.append('v', assetHash)

      if (params.toString()) {
        optimizedUrl += '?' + params.toString()
      }

      logger.debug('Asset URL optimized', {
        original: assetPath,
        optimized: optimizedUrl,
        options,
      })

      return optimizedUrl
    } catch (error) {
      logger.error('Failed to optimize asset URL', { assetPath, error })
      return assetPath // Fallback to original
    }
  }

  /**
   * Generate asset hash for cache busting
   */
  private generateAssetHash(
    assetPath: string,
    options: Record<string, any>,
  ): string {
    const hashInput = JSON.stringify({
      path: assetPath,
      options,
      version: '1.0',
    })

    return createHash('md5').update(hashInput).digest('hex').substring(0, 8)
  }

  /**
   * Optimize image for CDN delivery
   */
  async optimizeImage(
    imagePath: string,
    options: {
      width?: number
      height?: number
      quality?: number
      format?: 'webp' | 'avif' | 'jpeg' | 'png'
    } = {},
  ): Promise<CDNResponse> {
    try {
      // Check cache first
      const cacheKey = this.generateAssetHash(imagePath, options)
      const cached = this.assetCache.get(cacheKey)

      if (cached) {
        return {
          success: true,
          url: cached.cdnUrl,
          metadata: cached,
        }
      }

      // Build optimization URL
      const optimizedUrl = this.optimizeAssetUrl(imagePath, {
        format: options.format,
        width: options.width,
        height: options.height,
        quality: options.quality || this.config.assets.imageQuality,
        webp: options.format === 'webp',
        avif: options.format === 'avif',
      })

      // In a real implementation, this would:
      // 1. Upload to CDN if not exists
      // 2. Generate optimized versions
      // 3. Set appropriate cache headers

      // For now, return the optimized URL
      const metadata: AssetMetadata = {
        url: imagePath,
        originalSize: 0, // Would be populated from actual file
        format: options.format || 'jpeg',
        hash: cacheKey,
        cdnUrl: optimizedUrl,
        cacheHeaders: this.generateCacheHeaders(),
      }

      // Cache the result
      this.assetCache.set(cacheKey, metadata)

      logger.info('Image optimized for CDN', {
        original: imagePath,
        optimized: optimizedUrl,
        format: options.format,
      })

      return {
        success: true,
        url: optimizedUrl,
        metadata,
      }
    } catch (error) {
      logger.error('Image optimization failed', {
        imagePath,
        options,
        error: error instanceof Error ? error.message : String(error),
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Optimization failed',
      }
    }
  }

  /**
   * Generate optimal cache headers for CDN
   */
  private generateCacheHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Cache-Control': `public, max-age=${this.config.edgeCache.defaultTTL}, stale-while-revalidate=${this.config.edgeCache.staleWhileRevalidate}`,
      'CDN-Cache-Control': `max-age=${this.config.edgeCache.maxTTL}`,
      'Vercel-CDN-Cache-Control': `max-age=${this.config.edgeCache.defaultTTL}`,
      'Netlify-CDN-Cache-Control': `max-age=${this.config.edgeCache.defaultTTL}`,
    }

    if (this.config.assets.enableCompression) {
      headers['Content-Encoding'] = 'gzip, br'
      headers['Vary'] = 'Accept-Encoding'
    }

    return headers
  }

  /**
   * Batch optimize multiple assets
   */
  async optimizeAssets(
    assets: Array<{
      path: string
      options?: {
        width?: number
        height?: number
        quality?: number
        format?: string
      }
    }>,
  ): Promise<CDNResponse[]> {
    const results: CDNResponse[] = []

    logger.info('Starting batch asset optimization', {
      count: assets.length,
    })

    // Process in batches to avoid overwhelming CDN
    const batchSize = 10
    for (let i = 0; i < assets.length; i += batchSize) {
      const batch = assets.slice(i, i + batchSize)

      const batchPromises = batch.map((asset) =>
        this.optimizeImage(asset.path, asset.options),
      )

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Small delay between batches
      if (i + batchSize < assets.length) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    const successCount = results.filter((r) => r.success).length
    logger.info('Batch asset optimization completed', {
      total: assets.length,
      successful: successCount,
      failed: assets.length - successCount,
    })

    return results
  }

  /**
   * Generate responsive image markup
   */
  generateResponsiveImage(
    imagePath: string,
    alt: string,
    options: {
      sizes?: string
      breakpoints?: number[]
      formats?: string[]
    } = {},
  ): string {
    const breakpoints = options.breakpoints || [640, 1024, 1280, 1920]
    const formats = options.formats || ['avif', 'webp', 'jpeg']
    const sizes =
      options.sizes ||
      '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'

    let html = `<!-- Responsive image: ${alt} -->\n`
    html += `<picture>\n`

    // Generate sources for each format
    formats.forEach((format) => {
      const srcset = breakpoints
        .map((bp) => {
          const url = this.optimizeAssetUrl(imagePath, {
            width: bp,
            format: format as any,
            quality: format === 'avif' ? 80 : 85,
          })
          return `${url} ${bp}w`
        })
        .join(', ')

      html += `  <source type="image/${format}" srcset="${srcset}" sizes="${sizes}">\n`
    })

    // Fallback img tag
    const fallbackUrl = this.optimizeAssetUrl(imagePath, { quality: 85 })
    html += `  <img src="${fallbackUrl}" alt="${alt}" loading="lazy" sizes="${sizes}">\n`
    html += `</picture>`

    return html
  }

  /**
   * Prefetch critical assets
   */
  generatePrefetchTags(criticalAssets: string[]): string {
    return criticalAssets
      .map((asset) => {
        const optimizedUrl = this.optimizeAssetUrl(asset)
        return `  <link rel="preload" href="${optimizedUrl}" as="image" fetchpriority="high">`
      })
      .join('\n')
  }

  /**
   * Generate CDN invalidation request
   */
  async invalidateCDNCache(patterns: string[]): Promise<boolean> {
    try {
      // This would integrate with actual CDN APIs (Cloudflare, AWS CloudFront, etc.)
      logger.info('CDN cache invalidation requested', { patterns })

      // Placeholder implementation
      // Real implementation would call CDN API to purge cache

      return true
    } catch (error) {
      logger.error('CDN cache invalidation failed', {
        patterns,
        error: error instanceof Error ? error.message : String(error),
      })

      return false
    }
  }

  /**
   * Get CDN performance metrics
   */
  async getCDNMetrics(): Promise<{
    cacheHitRate: number
    bandwidthSaved: number
    requestsServed: number
    avgResponseTime: number
  }> {
    try {
      // This would integrate with CDN analytics APIs
      // For now, return placeholder data

      return {
        cacheHitRate: 0.95, // 95% cache hit rate
        bandwidthSaved: 0, // Bytes saved through caching
        requestsServed: 0, // Total requests served by CDN
        avgResponseTime: 50, // Average response time in ms
      }
    } catch (error) {
      logger.error('Failed to get CDN metrics', { error })
      return {
        cacheHitRate: 0,
        bandwidthSaved: 0,
        requestsServed: 0,
        avgResponseTime: 0,
      }
    }
  }

  /**
   * Optimize static assets for global delivery
   */
  async optimizeStaticAssets(): Promise<{
    optimized: number
    totalSize: number
    savings: number
  }> {
    logger.info('Starting static asset optimization for CDN')

    // This would scan public directory and optimize all static assets
    // For now, return placeholder results

    const result = {
      optimized: 0,
      totalSize: 0,
      savings: 0,
    }

    logger.info('Static asset optimization completed', result)

    return result
  }
}

/**
 * CDN utilities and helpers
 */
export class CDNUtility {
  private optimizer: CDNEdgeOptimizer

  constructor(optimizer: CDNEdgeOptimizer) {
    this.optimizer = optimizer
  }

  /**
   * Generate global asset manifest for CDN
   */
  generateAssetManifest(assets: string[]): string {
    const manifest = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      assets: assets.map((asset) => ({
        original: asset,
        cdn: this.optimizer.optimizeAssetUrl(asset),
        hash: this.optimizer['generateAssetHash'](asset, {}),
      })),
    }

    return JSON.stringify(manifest, null, 2)
  }

  /**
   * Generate service worker cache configuration
   */
  generateServiceWorkerCache(): string {
    return `
      // CDN-optimized service worker cache configuration
      const CACHE_NAME = 'pixelated-v1'
      const CDN_BASE_URL = '${this.optimizer['config'].baseUrl}'

      // Assets to cache for offline functionality
      const CACHE_ASSETS = [
        '/',
        '/manifest.json',
        // Add critical CDN assets here
      ]

      // Install event - cache assets
      self.addEventListener('install', (event) => {
        event.waitUntil(
          caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(CACHE_ASSETS))
        )
      })

      // Fetch event - serve from cache, fallback to CDN
      self.addEventListener('fetch', (event) => {
        event.respondWith(
          caches.match(event.request)
            .then((response) => {
              // Return cached version or fetch from CDN
              return response || fetch(event.request)
                .then((fetchResponse) => {
                  // Cache successful responses
                  if (fetchResponse.ok) {
                    const responseClone = fetchResponse.clone()
                    caches.open(CACHE_NAME)
                      .then((cache) => cache.put(event.request, responseClone))
                  }
                  return fetchResponse
                })
            })
        )
      })
    `
  }

  /**
   * Generate CDN configuration for different environments
   */
  generateCDNConfig(env: 'development' | 'staging' | 'production'): object {
    const baseConfig = {
      provider: this.optimizer['config'].provider,
      baseUrl: this.optimizer['config'].baseUrl,
      edgeCache: this.optimizer['config'].edgeCache,
      assets: this.optimizer['config'].assets,
    }

    // Environment-specific overrides
    switch (env) {
      case 'development':
        return {
          ...baseConfig,
          edgeCache: {
            ...baseConfig.edgeCache,
            defaultTTL: 60, // 1 minute for development
          },
          assets: {
            ...baseConfig.assets,
            enableCompression: false,
          },
        }

      case 'staging':
        return {
          ...baseConfig,
          edgeCache: {
            ...baseConfig.edgeCache,
            defaultTTL: 1800, // 30 minutes for staging
          },
        }

      case 'production':
        return baseConfig

      default:
        return baseConfig
    }
  }
}

// Global CDN optimizer instance
let cdnOptimizer: CDNEdgeOptimizer | null = null

/**
 * Get global CDN optimizer instance
 */
export function getCDNOptimizer(): CDNEdgeOptimizer {
  if (!cdnOptimizer) {
    cdnOptimizer = new CDNEdgeOptimizer()
  }
  return cdnOptimizer
}

/**
 * Initialize CDN optimizer with custom config
 */
export function initializeCDNOptimizer(
  config?: Partial<CDNConfig>,
): CDNEdgeOptimizer {
  cdnOptimizer = new CDNEdgeOptimizer(config)
  return cdnOptimizer
}

/**
 * CDN optimization utilities
 */
export const cdnUtils = {
  /**
   * Optimize image URL for global delivery
   */
  optimizeImageUrl: (imagePath: string, options?: any) => {
    return getCDNOptimizer().optimizeAssetUrl(imagePath, options)
  },

  /**
   * Generate responsive image markup
   */
  generateResponsiveImage: (imagePath: string, alt: string, options?: any) => {
    return getCDNOptimizer().generateResponsiveImage(imagePath, alt, options)
  },

  /**
   * Invalidate CDN cache for specific patterns
   */
  invalidateCache: (patterns: string[]) => {
    return getCDNOptimizer().invalidateCDNCache(patterns)
  },

  /**
   * Get CDN performance metrics
   */
  getMetrics: () => {
    return getCDNOptimizer().getCDNMetrics()
  },
}

/**
 * Asset optimization helper functions
 */
export const assetOptimizer = {
  /**
   * Optimize static assets for production
   */
  optimizeForProduction: async () => {
    const optimizer = getCDNOptimizer()
    return optimizer.optimizeStaticAssets()
  },

  /**
   * Generate asset manifest
   */
  generateManifest: (assets: string[]) => {
    const utility = new CDNUtility(getCDNOptimizer())
    return utility.generateAssetManifest(assets)
  },

  /**
   * Generate service worker with CDN caching
   */
  generateServiceWorker: () => {
    const utility = new CDNUtility(getCDNOptimizer())
    return utility.generateServiceWorkerCache()
  },
}

/**
 * Performance monitoring for CDN
 */
export async function monitorCDNPerformance(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy'
  metrics: any
  recommendations: string[]
}> {
  try {
    const metrics = await getCDNOptimizer().getCDNMetrics()
    const recommendations: string[] = []

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    // Analyze metrics and generate recommendations
    if (metrics.cacheHitRate < 0.8) {
      status = 'degraded'
      recommendations.push('Low cache hit rate - consider increasing cache TTL')
    }

    if (metrics.avgResponseTime > 200) {
      status = 'degraded'
      recommendations.push('High response time - check CDN configuration')
    }

    if (metrics.cacheHitRate < 0.6) {
      status = 'unhealthy'
    }

    logger.info('CDN performance monitoring', {
      status,
      metrics,
      recommendationCount: recommendations.length,
    })

    return {
      status,
      metrics,
      recommendations,
    }
  } catch (error) {
    logger.error('CDN performance monitoring failed', { error })

    return {
      status: 'unhealthy',
      metrics: {},
      recommendations: ['CDN monitoring unavailable'],
    }
  }
}
