/**
 * Secure Secret Management System
 *
 * Centralized utility for retrieving sensitive environment variables with 
 * validation, error handling, and security checks.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('secrets-manager')

/**
 * List of mandatory environment variables for production
 */
const MANDATORY_SECRETS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
  'SENTRY_DSN',
  'REDIS_URL',
  'MONGODB_URI',
]

/**
 * Retrieves a secret from environment variables with validation
 * 
 * @param name - The name of the environment variable
 * @param defaultValue - Optional fallback value (not recommended for production secrets)
 * @returns The secret value
 * @throws Error if the secret is mandatory and missing in production
 */
export function getSecret(name: string, defaultValue?: string): string {
  const value = process.env[name] || defaultValue

  if (!value) {
    const isProduction = process.env.NODE_ENV === 'production'
    const isMandatory = MANDATORY_SECRETS.includes(name)

    if (isProduction && isMandatory) {
      logger.error(`CRITICAL: Mandatory secret ${name} is missing in production environment!`)
      throw new Error(`Mandatory environment variable ${name} is not set`)
    }

    if (isMandatory) {
      logger.warn(`Warning: Mandatory secret ${name} is missing in ${process.env.NODE_ENV} environment.`)
    }
  }

  return value || ''
}

/**
 * Validates that all mandatory secrets are present
 * Should be called at application startup.
 * 
 * @returns boolean - true if all mandatory secrets are present
 */
export function validateSecrets(): boolean {
  const missing = MANDATORY_SECRETS.filter(name => !process.env[name])
  
  if (missing.length > 0) {
    const isProduction = process.env.NODE_ENV === 'production'
    const message = `Startup secret validation failed. Missing: ${missing.join(', ')}`
    
    if (isProduction) {
      logger.error(`CRITICAL: ${message}`)
      return false
    }
    
    logger.warn(message)
  }

  logger.info('All mandatory secrets validated successfully')
  return true
}

/**
 * Checks if a specific secret is set
 */
export function hasSecret(name: string): boolean {
  return !!process.env[name]
}
