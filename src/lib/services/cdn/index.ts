import type { CdnConfig } from '../../../config/cdn'
import { cdnConfigSchema, defaultCdnConfig } from '../../../config/cdn'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

export class CdnService {
  private static instance: CdnService
  private config: CdnConfig
  private initialized: boolean = false

  private constructor() {
    this.config = defaultCdnConfig
  }

  public static getInstance(): CdnService {
    if (!CdnService.instance) {
      CdnService.instance = new CdnService()
    }
    return CdnService.instance
  }

  public async initialize(config?: Partial<CdnConfig>): Promise<void> {
    if (this.initialized) {
      logger.warn('CdnService already initialized')
      return
    }

    try {
      // Merge provided config with default config
      const mergedConfig = {
        ...defaultCdnConfig,
        ...config,
      }

      // Validate config
      this.config = cdnConfigSchema.parse(mergedConfig)

      // Initialize edge locations
      await this.initializeEdgeLocations()

      // Set up cache rules
      await this.initializeCacheRules()

      // Configure security headers
      await this.initializeSecurityHeaders()

      // Set up performance optimizations
      await this.initializePerformanceOptimizations()

      this.initialized = true
      logger.info('CdnService initialized successfully')
    } catch (error: unknown) {
      const errorData =
        error instanceof Error
          ? { message: String(error), stack: (error as Error)?.stack }
          : { message: String(error) }
      logger.error('Failed to initialize CdnService', errorData)
      throw error
    }
  }

  private async initializeEdgeLocations(): Promise<void> {
    try {
      const { edgeLocations } = this.config

      // Enable edge locations
      for (const location of edgeLocations) {
        if (location.isEnabled) {
          logger.info(`Enabling edge location: ${location.region}`)
          // Here you would typically make API calls to your CDN provider
          // to configure edge locations
        }
      }
    } catch (error: unknown) {
      const errorData =
        error instanceof Error
          ? { message: String(error), stack: (error as Error)?.stack }
          : { message: String(error) }
      logger.error('Failed to initialize edge locations', errorData)
      throw error
    }
  }

  private async initializeCacheRules(): Promise<void> {
    try {
      const { cache } = this.config

      // Set default TTL
      logger.info(`Setting default TTL: ${cache.defaultTtl}s`)

      // Configure cache rules
      for (const rule of cache.rules) {
        if (rule.isEnabled) {
          logger.info(`Setting cache rule for ${rule.pattern}: ${rule.ttl}s`)
          // Here you would typically make API calls to your CDN provider
          // to configure cache rules
        }
      }

      // Configure cache invalidation
      if (cache.invalidation.useSoftInvalidation) {
        logger.info('Configuring soft cache invalidation')
        // Configure soft invalidation
      }

      // Set up cache warmup
      if (cache.warmup.isEnabled) {
        logger.info('Setting up cache warmup')
        await this.warmupCache()
      }
    } catch (error: unknown) {
      const errorData =
        error instanceof Error
          ? { message: String(error), stack: (error as Error)?.stack }
          : { message: String(error) }
      logger.error('Failed to initialize cache rules', errorData)
      throw error
    }
  }

  private async initializeSecurityHeaders(): Promise<void> {
    try {
      const { security } = this.config

      // Configure security headers
      const securityHeaders = {
        'Content-Security-Policy': security.contentSecurityPolicy,
        'Strict-Transport-Security': `max-age=${security.hstsMaxAge}; includeSubDomains; preload`,
        'X-Content-Type-Options': security.nosniff ? 'nosniff' : null,
        'X-Frame-Options': security.frameOptions,
        'Referrer-Policy': security.referrerPolicy,
      }

      logger.info('Configuring security headers')
      // Here you would typically make API calls to your CDN provider
      // to configure security headers with securityHeaders object

      // Example usage of the securityHeaders object:
      Object.entries(securityHeaders).forEach(([key, value]) => {
        if (value !== null) {
          logger.info(`Setting security header: ${key}`)
        }
      })
    } catch (error: unknown) {
      const errorData =
        error instanceof Error
          ? { message: String(error), stack: (error as Error)?.stack }
          : { message: String(error) }
      logger.error('Failed to initialize security headers', errorData)
      throw error
    }
  }

  private async initializePerformanceOptimizations(): Promise<void> {
    try {
      const { performance } = this.config

      // Enable Brotli compression
      if (performance.brotli) {
        logger.info('Enabling Brotli compression')
        // Configure Brotli
      }

      // Enable HTTP/3
      if (performance.http3) {
        logger.info('Enabling HTTP/3')
        // Configure HTTP/3
      }

      // Enable early hints
      if (performance.earlyHints) {
        logger.info('Enabling early hints')
        // Configure early hints
      }

      // Enable resource hints
      if (performance.resourceHints) {
        logger.info('Enabling resource hints')
        // Configure resource hints
      }

      // Configure image optimization
      if (performance.imageOptimization.isEnabled) {
        logger.info('Configuring image optimization')
        // Configure image optimization
      }
    } catch (error: unknown) {
      const errorData =
        error instanceof Error
          ? { message: String(error), stack: (error as Error)?.stack }
          : { message: String(error) }
      logger.error('Failed to initialize performance optimizations', errorData)
      throw error
    }
  }

  private async warmupCache(): Promise<void> {
    try {
      const { warmup } = this.config.cache

      if (!warmup.isEnabled || !warmup.urls.length) {
        return
      }

      logger.info('Starting cache warmup')
      const promises = warmup.urls.map(async (url) => {
        try {
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`Failed to warm up ${url}: ${response.status}`)
          }
          logger.info(`Successfully warmed up ${url}`)
        } catch (error: unknown) {
          const errorData =
            error instanceof Error
              ? { message: String(error), stack: (error as Error)?.stack }
              : { message: String(error) }
          logger.error(`Failed to warm up ${url}`, errorData)
        }
      })

      await Promise.all(promises)
      logger.info('Cache warmup completed')
    } catch (error: unknown) {
      const errorData =
        error instanceof Error
          ? { message: String(error), stack: (error as Error)?.stack }
          : { message: String(error) }
      logger.error('Failed to warm up cache', errorData)
      throw error
    }
  }

  public async invalidateCache(patterns: string[]): Promise<void> {
    try {
      logger.info(`Invalidating cache for patterns: ${patterns.join(', ')}`)
      // Here you would typically make API calls to your CDN provider
      // to invalidate cache for the specified patterns
    } catch (error: unknown) {
      const errorData =
        error instanceof Error
          ? { message: String(error), stack: (error as Error)?.stack }
          : { message: String(error) }
      logger.error('Failed to invalidate cache', errorData)
      throw error
    }
  }

  public async getEdgeMetrics(): Promise<Record<string, unknown>> {
    try {
      const metrics: Record<string, unknown> = {}

      // Collect metrics from each edge location
      for (const location of this.config.edgeLocations) {
        if (location.isEnabled) {
          // Here you would typically make API calls to your CDN provider
          // to get metrics for each edge location
          metrics[location.region] = {
            cacheHitRate: 0.95, // Example metric
            bandwidth: 1000000, // Example metric
            requests: 50000, // Example metric
          }
        }
      }

      return metrics
    } catch (error: unknown) {
      const errorData =
        error instanceof Error
          ? { message: String(error), stack: (error as Error)?.stack }
          : { message: String(error) }
      logger.error('Failed to get edge metrics', errorData)
      throw error
    }
  }

  public async optimizeImage(
    url: string,
    options: {
      width?: number
      height?: number
      quality?: number
      format?: 'webp' | 'avif'
    },
  ): Promise<string> {
    try {
      if (!this.config.performance.imageOptimization.isEnabled) {
        return url
      }

      // Here you would typically make API calls to your CDN provider
      // to optimize the image with the specified options
      return `${url}?w=${options.width}&h=${options.height}&q=${options.quality}&f=${options.format}`
    } catch (error: unknown) {
      const errorData =
        error instanceof Error
          ? { message: String(error), stack: (error as Error)?.stack }
          : { message: String(error) }
      logger.error('Failed to optimize image', errorData)
      return url
    }
  }
}
