/**
 * Authentication Configuration
 * Centralized configuration for JWT and Better-Auth settings
 */

// JWT Configuration
export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  audience: process.env.JWT_AUDIENCE || 'pixelated-empathy',
  issuer: process.env.JWT_ISSUER || 'pixelated-auth-service',
  accessTokenExpiry: 24 * 60 * 60, // 24 hours
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
  algorithm: 'HS256' as const,
}

// Better-Auth Configuration
export const BETTER_AUTH_CONFIG = {
  database: {
    provider: process.env.DATABASE_PROVIDER || 'sqlite',
    url: process.env.DATABASE_URL || ':memory:',
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: process.env.NODE_ENV === 'production',
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
  },
  user: {
    modelName: 'users',
    fields: {
      role: {
        type: 'string',
        defaultValue: 'guest',
      },
      createdAt: {
        type: 'number',
        defaultValue: Date.now,
      },
      updatedAt: {
        type: 'number',
        defaultValue: Date.now,
      },
    },
  },
  session: {
    modelName: 'sessions',
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  rateLimit: {
    window: 10,
    max: 10,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  security: {
    bcryptRounds: 12,
    sessionSecret: process.env.SESSION_SECRET || 'fallback-session-secret',
  },
}

// Rate Limiting Configuration
export const RATE_LIMIT_CONFIG = {
  authEndpoints: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
  generalEndpoints: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  },
  apiEndpoints: {
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
  },
}

// Security Configuration
export const SECURITY_CONFIG = {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:4321'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  },
  csrf: {
    enabled: process.env.NODE_ENV === 'production',
    secret: process.env.CSRF_SECRET || 'fallback-csrf-secret',
  },
  headers: {
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      frameAncestors: ["'none'"],
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
  },
}

// Role-based Access Control Configuration
export const RBAC_CONFIG = {
  roles: ['admin', 'therapist', 'researcher', 'patient', 'guest'] as const,
  permissions: {
    admin: ['*'], // All permissions
    therapist: [
      'read:patients',
      'write:notes',
      'read:analytics',
      'read:research_data',
      'write:interventions',
    ],
    researcher: [
      'read:analytics',
      'read:research_data',
      'write:research_notes',
    ],
    patient: ['read:own_data', 'write:own_notes', 'read:own_analytics'],
    guest: ['read:public_content'],
  },
  roleHierarchy: {
    admin: 100,
    therapist: 80,
    researcher: 60,
    patient: 40,
    guest: 20,
  },
}

// Token Configuration
export const TOKEN_CONFIG = {
  cleanup: {
    interval: 60 * 60 * 1000, // 1 hour
    batchSize: 100,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours for revoked tokens
  },
  blacklist: {
    enabled: true,
    maxSize: 10000,
    cleanupInterval: 60 * 60 * 1000, // 1 hour
  },
}

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  tokenValidation: {
    maxResponseTime: 50, // 50ms target
    cacheEnabled: true,
    cacheTtl: 5 * 60, // 5 minutes
  },
  tokenGeneration: {
    maxResponseTime: 100, // 100ms target
  },
  rateLimiting: {
    maxResponseTime: 10, // 10ms target
  },
}

// HIPAA Compliance Configuration
export const HIPAA_CONFIG = {
  auditLogging: {
    enabled: true,
    includeSensitiveData: false,
    retentionPeriod: 7 * 24 * 60 * 60 * 1000, // 7 years in milliseconds
  },
  encryption: {
    enabled: true,
    algorithm: 'AES-256-GCM',
    keyRotationInterval: 90 * 24 * 60 * 60 * 1000, // 90 days
  },
  dataRetention: {
    userData: 7 * 24 * 60 * 60 * 1000, // 7 years
    sessionData: 24 * 60 * 60 * 1000, // 24 hours
    auditLogs: 7 * 24 * 60 * 60 * 1000, // 7 years
  },
}

/**
 * Get complete authentication configuration
 */
export function getAuthConfig() {
  return {
    jwt: JWT_CONFIG,
    betterAuth: BETTER_AUTH_CONFIG,
    rateLimit: RATE_LIMIT_CONFIG,
    security: SECURITY_CONFIG,
    rbac: RBAC_CONFIG,
    token: TOKEN_CONFIG,
    performance: PERFORMANCE_CONFIG,
    hipaa: HIPAA_CONFIG,
  }
}

/**
 * Validate configuration
 */
export function validateAuthConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Validate JWT secret
  if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    errors.push('JWT_SECRET is required in production')
  }

  // Validate database configuration
  if (
    !BETTER_AUTH_CONFIG.database.url &&
    process.env.NODE_ENV === 'production'
  ) {
    errors.push('DATABASE_URL is required in production')
  }

  // Validate session secret
  if (
    !BETTER_AUTH_CONFIG.security.sessionSecret &&
    process.env.NODE_ENV === 'production'
  ) {
    errors.push('SESSION_SECRET is required in production')
  }

  // Validate social provider configuration
  if (
    BETTER_AUTH_CONFIG.socialProviders.google.enabled &&
    (!BETTER_AUTH_CONFIG.socialProviders.google.clientId ||
      !BETTER_AUTH_CONFIG.socialProviders.google.clientSecret)
  ) {
    errors.push(
      'Google OAuth client ID and secret are required when Google auth is enabled',
    )
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Environment-specific configuration
 */
export function getEnvironmentConfig() {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const isProduction = process.env.NODE_ENV === 'production'
  const isTest = process.env.NODE_ENV === 'test'

  return {
    isDevelopment,
    isProduction,
    isTest,
    debug: isDevelopment || process.env.DEBUG === 'true',
    strictMode: isProduction,
    enableDetailedErrors: isDevelopment,
    enableStackTraces: isDevelopment || isTest,
  }
}
