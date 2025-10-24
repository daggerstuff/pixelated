/**
 * Default configuration for the rate limiting system
 */

import type {
  RateLimitConfig,
  RateLimitRuleSet,
  RateLimitBypassRule,
  DDoSProtectionConfig,
  BetterAuthRateLimitConfig,
  WebSocketRateLimitConfig,
} from './types'

/**
 * Default rate limiting configuration
 */
export const defaultRateLimitConfig: RateLimitConfig = {
  global: {
    enabled: true,
    defaultWindowMs: 60000, // 1 minute
    enableAttackDetection: true,
    enableAnalytics: true,
  },
  redis: {
    keyPrefix: 'rate_limit:',
    analyticsRetentionDays: 30,
    securityEventRetentionDays: 7,
  },
}

/**
 * Default rate limit rules for different scenarios
 */
export const defaultRuleSets: RateLimitRuleSet[] = [
  {
    name: 'api_general',
    description: 'General API rate limiting',
    rules: [
      {
        name: 'strict',
        maxRequests: 10,
        windowMs: 60000, // 1 minute
        priority: 100,
        enableAttackDetection: true,
        description: 'Strict rate limiting for sensitive endpoints',
        tags: ['strict', 'sensitive'],
      },
      {
        name: 'moderate',
        maxRequests: 100,
        windowMs: 60000, // 1 minute
        priority: 50,
        enableAttackDetection: true,
        description: 'Moderate rate limiting for general API endpoints',
        tags: ['moderate', 'api'],
      },
      {
        name: 'lenient',
        maxRequests: 1000,
        windowMs: 60000, // 1 minute
        priority: 10,
        enableAttackDetection: false,
        description: 'Lenient rate limiting for public endpoints',
        tags: ['lenient', 'public'],
      },
    ],
  },
  {
    name: 'auth_endpoints',
    description: 'Rate limiting for authentication endpoints',
    rules: [
      {
        name: 'login_attempts',
        maxRequests: 5,
        windowMs: 300000, // 5 minutes
        priority: 100,
        enableAttackDetection: true,
        description: 'Login attempt rate limiting',
        tags: ['auth', 'login', 'security'],
      },
      {
        name: 'password_reset',
        maxRequests: 3,
        windowMs: 3600000, // 1 hour
        priority: 90,
        enableAttackDetection: true,
        description: 'Password reset rate limiting',
        tags: ['auth', 'password', 'security'],
      },
      {
        name: 'registration',
        maxRequests: 2,
        windowMs: 3600000, // 1 hour
        priority: 80,
        enableAttackDetection: true,
        description: 'Registration rate limiting',
        tags: ['auth', 'register', 'security'],
      },
    ],
  },
  {
    name: 'ai_services',
    description: 'Rate limiting for AI service endpoints',
    rules: [
      {
        name: 'ai_completion',
        maxRequests: 20,
        windowMs: 60000, // 1 minute
        priority: 100,
        enableAttackDetection: true,
        description: 'AI completion endpoint rate limiting',
        tags: ['ai', 'completion', 'expensive'],
      },
      {
        name: 'bias_detection',
        maxRequests: 10,
        windowMs: 60000, // 1 minute
        priority: 90,
        enableAttackDetection: true,
        description: 'Bias detection endpoint rate limiting',
        tags: ['ai', 'bias', 'analysis'],
      },
    ],
  },
]

/**
 * Default bypass rules for trusted entities
 */
export const defaultBypassRules: RateLimitBypassRule[] = [
  {
    name: 'admin_users',
    description: 'Bypass for admin users',
    conditions: {
      roles: ['admin', 'superadmin', 'system'],
    },
  },
  {
    name: 'internal_services',
    description: 'Bypass for internal service calls',
    conditions: {
      ips: [
        '127.0.0.1',
        '::1',
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
      ],
      custom: async (context) => {
        // Check for internal service headers
        return context.metadata?.['x-internal-service'] === 'true'
      },
    },
  },
  {
    name: 'health_checks',
    description: 'Bypass for health check endpoints',
    conditions: {
      paths: ['/health', '/health/*', '/api/health', '/api/health/*'],
      custom: async (context) => {
        // Check for health check user agents
        const userAgent = context.userAgent?.toLowerCase() || ''
        return userAgent.includes('health') || userAgent.includes('monitor')
      },
    },
  },
]

/**
 * Default DDoS protection configuration
 */
export const defaultDDoSConfig: DDoSProtectionConfig = {
  enabled: true,
  threshold: 100, // 100 requests per second
  windowMs: 1000, // 1 second window
  blockDurationMs: 300000, // 5 minute block
  enableAutoBlock: true,
  enableAlerting: true,
}

/**
 * Default Better-Auth rate limiting configuration
 */
export const defaultBetterAuthConfig: BetterAuthRateLimitConfig = {
  enabled: true,
  bypassAuthenticated: true,
  bypassRoles: ['admin', 'therapist', 'premium'],
  authRules: {
    login: {
      name: 'betterauth_login',
      maxRequests: 5,
      windowMs: 300000, // 5 minutes
      priority: 100,
      enableAttackDetection: true,
      description: 'Better-Auth login rate limiting',
    },
    register: {
      name: 'betterauth_register',
      maxRequests: 2,
      windowMs: 3600000, // 1 hour
      priority: 90,
      enableAttackDetection: true,
      description: 'Better-Auth registration rate limiting',
    },
    passwordReset: {
      name: 'betterauth_password_reset',
      maxRequests: 3,
      windowMs: 3600000, // 1 hour
      priority: 80,
      enableAttackDetection: true,
      description: 'Better-Auth password reset rate limiting',
    },
    emailVerification: {
      name: 'betterauth_email_verification',
      maxRequests: 5,
      windowMs: 3600000, // 1 hour
      priority: 70,
      enableAttackDetection: true,
      description: 'Better-Auth email verification rate limiting',
    },
  },
}

/**
 * Default WebSocket rate limiting configuration
 */
export const defaultWebSocketConfig: WebSocketRateLimitConfig = {
  enabled: true,
  maxMessagesPerConnection: 100,
  maxConnectionsPerIp: 5,
  connectionTimeoutMs: 300000, // 5 minutes
}

/**
 * Environment-specific configurations
 */
export const getEnvironmentConfig = (env: string) => {
  switch (env) {
    case 'production':
      return {
        ...defaultRateLimitConfig,
        global: {
          ...defaultRateLimitConfig.global,
          enableAttackDetection: true,
          enableAnalytics: true,
        },
      }
    case 'staging':
      return {
        ...defaultRateLimitConfig,
        global: {
          ...defaultRateLimitConfig.global,
          enableAttackDetection: true,
          enableAnalytics: true,
        },
      }
    case 'development':
      return {
        ...defaultRateLimitConfig,
        global: {
          ...defaultRateLimitConfig.global,
          enableAttackDetection: true,
          enableAnalytics: false, // Disable analytics in dev for performance
        },
      }
    case 'test':
      return {
        ...defaultRateLimitConfig,
        global: {
          ...defaultRateLimitConfig.global,
          enabled: false, // Disable rate limiting in tests
          enableAttackDetection: false,
          enableAnalytics: false,
        },
      }
    default:
      return defaultRateLimitConfig
  }
}

/**
 * Get configuration from environment variables
 */
export const getConfigFromEnv = (): Partial<RateLimitConfig> => {
  const config: Partial<RateLimitConfig> = {}

  if (process.env.RATE_LIMIT_ENABLED) {
    config.global = {
      ...config.global,
      enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    }
  }

  if (process.env.RATE_LIMIT_DEFAULT_WINDOW_MS) {
    config.global = {
      ...config.global,
      defaultWindowMs: parseInt(process.env.RATE_LIMIT_DEFAULT_WINDOW_MS),
    }
  }

  if (process.env.RATE_LIMIT_ATTACK_DETECTION) {
    config.global = {
      ...config.global,
      enableAttackDetection: process.env.RATE_LIMIT_ATTACK_DETECTION === 'true',
    }
  }

  if (process.env.RATE_LIMIT_ANALYTICS) {
    config.global = {
      ...config.global,
      enableAnalytics: process.env.RATE_LIMIT_ANALYTICS === 'true',
    }
  }

  if (process.env.RATE_LIMIT_REDIS_PREFIX) {
    config.redis = {
      ...config.redis,
      keyPrefix: process.env.RATE_LIMIT_REDIS_PREFIX,
    }
  }

  return config
}

/**
 * Merge default configuration with environment-specific and env var configurations
 */
export const getMergedConfig = (): RateLimitConfig => {
  const env = process.env.NODE_ENV || 'development'
  const envConfig = getEnvironmentConfig(env)
  const envVarConfig = getConfigFromEnv()

  return {
    ...envConfig,
    ...envVarConfig,
    global: {
      ...envConfig.global,
      ...envVarConfig.global,
    },
    redis: {
      ...envConfig.redis,
      ...envVarConfig.redis,
    },
  }
}
