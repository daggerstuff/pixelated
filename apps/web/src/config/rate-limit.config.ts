import config from './env.config'

/**
 * Rate limiting configuration interface
 */
export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
  enabled: boolean
  message: string
  statusCode: number
  headers: boolean
  skipTrustedIPs?: string[]
}

/**
 * Rate limiting configuration for API endpoints
 */
export const rateLimitConfig = {
  /**
   * Default rate limiting settings
   */
  default: {
    /**
     * Maximum number of requests allowed in the specified window
     */
    maxRequests: config.rateLimiting.maxRequests(),

    /**
     * Time window in milliseconds for rate limiting
     */
    windowMs: config.rateLimiting.windowMs(),

    /**
     * Whether rate limiting is enabled
     */
    enabled: config.server.enableRateLimiting(),

    /**
     * Message to return when rate limit is exceeded
     */
    message: 'Too many requests, please try again later.',

    /**
     * HTTP status code to return when rate limit is exceeded
     */
    statusCode: 429,

    /**
     * Headers to include in the response
     */
    headers: true,

    /**
     * Skip rate limiting for trusted IPs (e.g., internal services)
     */
    skipTrustedIPs: ['127.0.0.1', '::1'],
  } as RateLimitOptions,

  /**
   * Authentication-specific rate limiting settings
   */
  auth: {
    /**
     * More restrictive rate limits for authentication endpoints
     */
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    message: 'Too many authentication attempts, please try again later.',
  },

  /**
   * API-specific rate limiting settings
   */
  api: {
    /**
     * Standard API rate limits
     */
    maxRequests: 300,
    windowMs: 5 * 60 * 1000, // 5 minutes
    message: 'API rate limit exceeded, please slow down your requests.',
  },

  /**
   * Rate limiting for sensitive operations
   */
  sensitive: {
    /**
     * Highly restrictive rate limits for sensitive operations
     */
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many sensitive operations attempted. Please try again later.',
  },

  /**
   * Get rate limit configuration for a specific endpoint type
   * Merges default config with endpoint-specific overrides
   */
  getConfig: (
    type: 'default' | 'auth' | 'api' | 'sensitive',
  ): RateLimitOptions => {
    if (!rateLimitConfig.default.enabled) {
      return { ...rateLimitConfig.default, enabled: false }
    }

    const baseConfig = rateLimitConfig.default

    if (type === 'default') {
      return baseConfig
    }

    return {
      ...baseConfig,
      ...rateLimitConfig[type],
    }
  },
}

export default rateLimitConfig
