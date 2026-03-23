import { z } from 'zod'
import { apiEnvSchema } from './env/api'
export {
  aiConfig,
  authConfig,
  azureConfig,
  clientConfig,
  config,
  databaseConfig,
  emailConfig,
  environmentConfig,
  loggingConfig,
  mentalLLaMAConfig,
  monitoringConfig,
  notificationConfig,
  rateLimitingConfig,
  redisConfig,
  securityConfig,
  serverConfig,
  siteConfig,
  twilioConfig,
  workerConfig,
} from './env/accessors'
import { authEnvSchema } from './env/auth'
import { azureEnvSchema } from './env/azure'
import { clientEnvSchema } from './env/client'
import { coreEnvSchema } from './env/core'
import { databaseEnvSchema } from './env/database'
import { mentalLLaMAEnvSchema } from './env/mental-llama'
import { messagingEnvSchema } from './env/messaging'
import { monitoringEnvSchema } from './env/monitoring'
import { securityEnvSchema } from './env/security'

/**
 * Environment variable schema with validation
 */
const envSchema = coreEnvSchema
  .merge(databaseEnvSchema)
  .merge(authEnvSchema)
  .merge(apiEnvSchema)
  .merge(azureEnvSchema)
  .merge(monitoringEnvSchema)
  .merge(messagingEnvSchema)
  .merge(securityEnvSchema)
  .merge(clientEnvSchema)
  .merge(mentalLLaMAEnvSchema)

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
    /^MENTALLAMA_(DEFAULT_MODEL_TIER|ENABLE_PYTHON_BRIDGE|PYTHON_BRIDGE_SCRIPT_PATH)$/,
  ]
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [
      k,
      v === undefined ||
      v === null
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
    envSource = process.env as Record<string, unknown>
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
    if (!cachedEnvInstance) {
      cachedEnvInstance = getEnv()
    }
    return cachedEnvInstance
  }
})()

/**
 * Type definition for environment variables
 */
export type Env = z.infer<typeof envSchema>

/**
 * Environment configuration object
 */
