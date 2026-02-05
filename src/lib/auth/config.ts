/**
 * Authentication Configuration
 * Centralized configuration for JWT and Better-Auth settings
 */

// JWT Configuration
export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
  audience: process.env.JWT_AUDIENCE || 'pixelated-empathy',
  issuer: process.env.JWT_ISSUER || 'pixelated-auth-service',
  accessTokenExpiry: 24 * 60 * 60, // 24 hours - matching original inline config per PR requirements
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
  algorithm: 'HS256' as const,
}

// Auth0 Configuration
export const AUTH0_CONFIG = {
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  audience: process.env.AUTH0_AUDIENCE || '',
  callbackUrl:
    process.env.AUTH0_CALLBACK_URL || 'http://localhost:4321/api/auth/callback',
  scope: 'openid profile email offline_access',
}

// Password Policy Configuration
export const PASSWORD_CONFIG = {
  minLength: 8,
  maxLength: 128,
  requireLowercase: true,
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: true,
}

// Bcrypt Configuration
export const BCRYPT_CONFIG = {
  rounds: 12,
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
    auth0: AUTH0_CONFIG,
    password: PASSWORD_CONFIG,
    bcrypt: BCRYPT_CONFIG,
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

  // Validate Auth0 configuration in production
  if (process.env.NODE_ENV === 'production') {
    if (!AUTH0_CONFIG.domain) errors.push('AUTH0_DOMAIN is required')
    if (!AUTH0_CONFIG.clientId) errors.push('AUTH0_CLIENT_ID is required')
    if (!AUTH0_CONFIG.clientSecret) errors.push('AUTH0_CLIENT_SECRET is required')
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
