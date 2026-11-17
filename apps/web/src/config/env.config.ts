import { z } from 'zod'

import { aiEnvSchema } from './schemas/ai.schema'
import { authEnvSchema } from './schemas/auth.schema'
import { azureEnvSchema } from './schemas/azure.schema'
import { clientEnvSchema } from './schemas/client.schema'
import { databaseEnvSchema } from './schemas/database.schema'
import { monitoringEnvSchema } from './schemas/monitoring.schema'
import { notificationEnvSchema } from './schemas/notification.schema'
import { securityEnvSchema } from './schemas/security.schema'
import { serverEnvSchema } from './schemas/server.schema'

/**
 * Environment variable schema with validation
 * Merged from modular domain schemas
 */
export const envSchema = serverEnvSchema
  .and(databaseEnvSchema)
  .and(authEnvSchema)
  .and(aiEnvSchema)
  .and(monitoringEnvSchema)
  .and(securityEnvSchema)
  .and(notificationEnvSchema)
  .and(clientEnvSchema)
  .and(azureEnvSchema)

/**
 * Cache the validated environment variables
 */

// Helper to mask secrets in logs
function maskEnv(env: Record<string, unknown>): Record<string, unknown> {
  const secretKeyPatterns = [
    /SECRET/,
    /TOKEN/,
    /KEY$/,
    /PASSWORD/,
    /PRIVATE/,
    /DSN$/,
    /^DATABASE_URL$/,
    /^REDIS_URL$/,
    /^MONGODB_URI$/,
    /^SENTRY_DSN$/,
    /^AXIOM_TOKEN$/,
  ]
  const safeKeyPatterns = [
    /^PUBLIC_/,
    /^NODE_ENV$/,
    /^CI$/,
    /^PORT$/,
    /^LOG_LEVEL$/,
    /^ENABLE_RATE_LIMITING$/,
    /_WS_PORT$/,
    /^JWT_EXPIRES_IN$/,
    /^AZURE_OPENAI_API_VERSION$/,
    /^AZURE_OPENAI_DEPLOYMENT_NAME$/,
    /^AXIOM_DATASET$/,
    /^SITE_URL$/,
    /^SECURITY_(ENABLE_|MAX_|ACCOUNT_)/,
    /^RATE_LIMIT_/,
    /^LOG_(CONSOLE|AUDIT)$/,
    /^ENABLE_AUDIT_LOGGING$/,
    /^AUDIT_LOG_RETENTION_DAYS$/,
    /^ENCRYPTION_ALGORITHM$/,
    /^VAPID_SUBJECT$/,
    /^MENTAL_HEALTH_AI_(DEFAULT_MODEL_TIER|ENABLE_PYTHON_BRIDGE|PYTHON_BRIDGE_SCRIPT_PATH)$/,
  ]
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [
      k,
      v === undefined || v === null
        ? v
        : secretKeyPatterns.some((pattern) => pattern.test(k))
          ? '[hidden]'
          : safeKeyPatterns.some((pattern) => pattern.test(k))
            ? v
            : '[hidden]',
    ]),
  )
}

/**
 * Get the validated environment variables
 * (Refactored: stateless, no caching, for simplicity and correctness)
 */
export function getEnv(): z.infer<typeof envSchema> {
  // Type-safe environment source handling
  let envSource: Record<string, unknown>

  if (typeof process !== 'undefined') {
    envSource = process.env || {}
  } else {
    envSource = typeof import.meta !== 'undefined' ? import.meta.env : {}
  }

  // Log all env variables (masking secrets)
  // Only log in CI or production to avoid local noise
  if (envSource['CI'] || envSource['NODE_ENV'] === 'production') {
    console.log(
      '[env.config] Environment variables at build:',
      maskEnv(envSource),
    )
  }

  return envSchema.parse(envSource)
}

/**
 * Export the environment directly for convenience
 * Note: Lazy evaluation to avoid initialization issues during build
 */
export const env = (() => {
  let cachedEnvInstance: z.infer<typeof envSchema> | null = null
  return () => {
    cachedEnvInstance ??= getEnv()
    return cachedEnvInstance
  }
})()

/**
 * Type definition for environment variables
 */

export default config
