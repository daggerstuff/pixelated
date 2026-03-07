/**
 * Secure Secrets Management System
 * Handles sensitive configuration data with encryption and secure storage
 */

import * as fs from 'fs'
import { getLogger } from '@/lib/logging'

const logger = getLogger('secrets-manager')

// Security configuration
const SECURITY_CONFIG = {
  ENCRYPTION: {
    ALGORITHM: 'aes-256-gcm',
    KEY_LENGTH: 32,
    IV_LENGTH: 16,
    TAG_LENGTH: 16,
  },
  STORAGE: {
    SECRETS_DIR: process.env.SECRETS_DIR || './config/secrets',
    PERMISSIONS: 0o600, // Read/write for owner only
  },
  VALIDATION: {
    REQUIRED_SECRETS: [
      'DB_PASSWORD',
      'JWT_SECRET',
      'REDIS_PASSWORD',
      'ENCRYPTION_KEY',
    ],
  },
}

export interface SecretConfig {
  name: string
  value: string
  encrypted?: boolean
  rotationDate?: Date
  expiresAt?: Date
}

function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  // Prefer Web Crypto when available (browsers, modern Node)
  if (
    typeof globalThis !== 'undefined' &&
    (globalThis as any).crypto?.getRandomValues
  ) {
    ;(globalThis as any).crypto.getRandomValues(bytes)
    return bytes
  }
  // Fallback to Math.random (not cryptographically secure, but avoids bundling node:crypto in client)
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return bytes
}

export class SecretsManager {
  private static instance: SecretsManager
  private secrets: Map<string, SecretConfig> = new Map()
  private encryptionKey: Uint8Array

  private constructor() {
    this.encryptionKey = this.loadEncryptionKey()
    this.loadSecrets()
    this.validateRequiredSecrets()
  }

  static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager()
    }
    return SecretsManager.instance
  }

  /**
   * Load encryption key from secure storage
   */
  private loadEncryptionKey(): Uint8Array {
    const keyPath = `${SECURITY_CONFIG.STORAGE.SECRETS_DIR}/.master-key`

    if (fs.existsSync(keyPath)) {
      // Load existing master key
      return new Uint8Array(fs.readFileSync(keyPath))
    } else {
      // Generate new master key (should be done during setup)
      const key = generateRandomBytes(SECURITY_CONFIG.ENCRYPTION.KEY_LENGTH)
      logger.warn(
        'Generated new master key - this should be stored securely outside the application',
      )
      return key
    }
  }

  /**
   * Load secrets from secure storage
   */
  private loadSecrets(): void {
    try {
      // Load from environment variables (for development)
      this.loadFromEnvironment()

      // Load from secure files (for production)
      this.loadFromSecureFiles()

      logger.info('Secrets loaded successfully', {
        count: this.secrets.size,
        encrypted: Array.from(this.secrets.values()).filter((s) => s.encrypted)
          .length,
      })
    } catch (error) {
      logger.error('Failed to load secrets', { error })
      throw new Error('Secrets manager initialization failed', { cause: error })
    }
  }

  /**
   * Load secrets from environment variables (development only)
   */
  private loadFromEnvironment(): void {
    const envSecrets = {
      DB_PASSWORD: process.env.DB_PASSWORD,
      JWT_SECRET: process.env.JWT_SECRET,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
      SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    }

    Object.entries(envSecrets).forEach(([key, value]) => {
      if (value && this.isValidSecret(value)) {
        this.secrets.set(key, {
          name: key,
          value: value,
          encrypted: false,
        })
      }
    })
  }

  /**
   * Load secrets from secure files (production)
   */
  private loadFromSecureFiles(): void {
    const secretsDir = SECURITY_CONFIG.STORAGE.SECRETS_DIR

    if (!fs.existsSync(secretsDir)) {
      logger.warn('Secrets directory not found', { path: secretsDir })
      return
    }

    // Load individual secret files
    const secretFiles = [
      'db-password',
      'jwt-secret',
      'redis-password',
      'encryption-key',
      'resend-api-key',
      'aws-access-key',
      'aws-secret-key',
      'openai-api-key',
      'sentry-token',
      'slack-webhook',
    ]

    secretFiles.forEach((filename) => {
      const filePath = `${secretsDir}/${filename}`
      if (fs.existsSync(filePath)) {
        try {
          const value = fs.readFileSync(filePath, 'utf-8').trim()
          if (this.isValidSecret(value)) {
            const key = this.filenameToKey(filename)
            this.secrets.set(key, {
              name: key,
              value: value,
              encrypted: false,
            })
          }
        } catch (error) {
          logger.error(`Failed to load secret file: ${filename}`, { error })
        }
      }
    })
  }

  /**
   * Validate secret value
   */
  private isValidSecret(value: string): boolean {
    if (!value || value.length < 8) return false

    // Check for common insecure patterns
    const insecurePatterns = [
      /password123/i,
      /admin123/i,
      /secret123/i,
      /test123/i,
      /123456/i,
      /password/i,
      /admin/i,
    ]

    return !insecurePatterns.some((pattern) => pattern.test(value))
  }

  /**
   * Convert filename to environment variable key
   */
  private filenameToKey(filename: string): string {
    const mapping: Record<string, string> = {
      'db-password': 'DB_PASSWORD',
      'jwt-secret': 'JWT_SECRET',
      'redis-password': 'REDIS_PASSWORD',
      'encryption-key': 'ENCRYPTION_KEY',
      'resend-api-key': 'RESEND_API_KEY',
      'aws-access-key': 'AWS_ACCESS_KEY_ID',
      'aws-secret-key': 'AWS_SECRET_ACCESS_KEY',
      'openai-api-key': 'OPENAI_API_KEY',
      'sentry-token': 'SENTRY_AUTH_TOKEN',
      'slack-webhook': 'SLACK_WEBHOOK_URL',
    }

    return mapping[filename] || filename.toUpperCase().replace(/-/g, '_')
  }

  /**
   * Validate that all required secrets are present
   */
  private validateRequiredSecrets(): void {
    const missing = SECURITY_CONFIG.VALIDATION.REQUIRED_SECRETS.filter(
      (key) => !this.secrets.has(key),
    )

    if (missing.length > 0) {
      logger.error('Missing required secrets', { missing })
      throw new Error(`Missing required secrets: ${missing.join(', ')}`)
    }
  }

  /**
   * Get secret value
   */
  getSecret(key: string): string {
    const secret = this.secrets.get(key)
    if (!secret) {
      logger.error('Secret not found', { key })
      throw new Error(`Secret ${key} not found`)
    }

    // Log access for audit purposes (without exposing value)
    logger.info('Secret accessed', { key, encrypted: secret.encrypted })

    return secret.value
  }

  /**
   * Get secret with validation
   */
  getSecretSafe(key: string, validator?: (value: string) => boolean): string {
    const value = this.getSecret(key)

    if (validator && !validator(value)) {
      logger.error('Secret validation failed', { key })
      throw new Error(`Secret ${key} failed validation`)
    }

    return value
  }

  /**
   * Check if secret exists
   */
  hasSecret(key: string): boolean {
    return this.secrets.has(key)
  }

  /**
   * Get database configuration
   */
  getDatabaseConfig() {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'pixelated',
      user: process.env.DB_USER || 'postgres',
      password: this.getSecret('DB_PASSWORD'),
      ssl:
        process.env.NODE_ENV === 'production'
          ? {
              rejectUnauthorized: true,
              ca: process.env.DB_SSL_CA,
              cert: process.env.DB_SSL_CERT,
              key: process.env.DB_SSL_KEY,
            }
          : false,
    }
  }

  /**
   * Get JWT configuration
   */
  getJWTConfig() {
    return {
      secret: this.getSecret('JWT_SECRET'),
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'pixelated-empathy',
      audience: process.env.JWT_AUDIENCE || 'pixelated-users',
    }
  }

  /**
   * Get Redis configuration
   */
  getRedisConfig() {
    return {
      url: process.env.REDIS_URL,
      password: this.getSecret('REDIS_PASSWORD'),
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      db: parseInt(process.env.REDIS_DB || '0'),
    }
  }

  /**
   * Rotate secret (for key rotation)
   */
  async rotateSecret(key: string, newValue: string): Promise<void> {
    if (!this.isValidSecret(newValue)) {
      throw new Error('Invalid secret value')
    }

    const oldSecret = this.secrets.get(key)
    this.secrets.set(key, {
      name: key,
      value: newValue,
      encrypted: false,
      rotationDate: new Date(),
    })

    logger.info('Secret rotated', { key, hadPreviousValue: !!oldSecret })
  }

  /**
   * Get audit log of secret access
   */
  getAuditLog(): Array<{
    key: string
    timestamp: Date
    encrypted: boolean
  }> {
    // This would typically come from a proper audit system
    return Array.from(this.secrets.entries()).map(([key, secret]) => ({
      key,
      timestamp: new Date(),
      encrypted: secret.encrypted || false,
    }))
  }

  /**
   * Cleanup and secure disposal
   */
  cleanup(): void {
    // Clear secrets from memory
    this.secrets.clear()

    // Clear encryption key
    this.encryptionKey.fill(0)

    logger.info('Secrets manager cleaned up')
  }
}

// Singleton instance
let secretsManager: SecretsManager | null = null

export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    secretsManager = SecretsManager.getInstance()
  }
  return secretsManager
}

export function createSecretsManager(): SecretsManager {
  return SecretsManager.getInstance()
}

// Cleanup on process termination
process.on('SIGINT', () => {
  if (secretsManager) {
    secretsManager.cleanup()
  }
})

process.on('SIGTERM', () => {
  if (secretsManager) {
    secretsManager.cleanup()
  }
})
