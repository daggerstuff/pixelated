/**
 * Authentication Configuration
 * Centralized configuration for JWT and Better-Auth settings
 */

/**
 * Resolves the JWT secret from environment variables with strict validation.
 * Throws an error if the secret is missing, whitespace-only, or matches the legacy fallback.
 */
function ensureJwtSecret(): string {
  const secret = process.env['JWT_SECRET'] ?? import.meta.env['JWT_SECRET']
  const legacyFallback = 'fallback-secret-change-in-production'

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'JWT_SECRET environment variable is strictly required. ' +
        'Please set it in process.env.JWT_SECRET or import.meta.env.JWT_SECRET.',
    )
  }

  if (secret === legacyFallback) {
    throw new Error(
      'JWT_SECRET matches the insecure legacy fallback value. ' +
        'Please provide a unique, cryptographically secure secret.',
    )
  }

  return secret
}

// JWT Configuration
// The secret is resolved lazily (getter) so importing this module never
// throws at build time. Prerendered pages execute middleware during the
// static build, where JWT_SECRET is intentionally absent; validation
// still fires on first use at request time.
export const JWT_CONFIG = {
  get secret(): string {
    return ensureJwtSecret()
  },
  audience:
    process.env['JWT_AUDIENCE'] ??
    import.meta.env['JWT_AUDIENCE'] ??
    'pixelated-empathy',
  issuer:
    process.env['JWT_ISSUER'] ??
    import.meta.env['JWT_ISSUER'] ??
    'pixelated-auth-service',
  accessTokenExpiry: 24 * 60 * 60, // 24 hours - matching original inline config per PR requirements
  refreshTokenExpiry: 7 * 24 * 60 * 60, // 7 days
  algorithm: 'HS256' as const,
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
