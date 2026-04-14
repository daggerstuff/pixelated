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
  .merge(databaseEnvSchema)
  .merge(authEnvSchema)
  .merge(aiEnvSchema)
  .merge(monitoringEnvSchema)
  .merge(securityEnvSchema)
  .merge(notificationEnvSchema)
  .merge(clientEnvSchema)
  .merge(azureEnvSchema)

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
    envSource = (process.env as Record<string, unknown>) || {}
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
export const config = {
  isDevelopment: (): boolean => env().NODE_ENV === 'development',
  isProduction: (): boolean => env().NODE_ENV === 'production',
  isTest: (): boolean => env().NODE_ENV === 'test',

  server: {
    port: (): number => env().PORT,
    logLevel: (): string => env().LOG_LEVEL,
    enableRateLimiting: (): boolean => env().ENABLE_RATE_LIMITING,
  },

  workers: {
    analytics: {
      wsPort: (): number => env().ANALYTICS_WS_PORT,
    },
    notification: {
      wsPort: (): number => env().NOTIFICATION_WS_PORT,
    },
  },

  database: {
    mongoUri: (): string | undefined => env().MONGODB_URI,
    mongoDbName: (): string | undefined => env().MONGODB_DB_NAME,
    mongoUsername: (): string | undefined => env().MONGODB_USERNAME,
    mongoPassword: (): string | undefined => env().MONGODB_PASSWORD,
    mongoCluster: (): string | undefined => env().MONGODB_CLUSTER,

    // Legacy PostgreSQL support
    url: (): string | undefined => env().POSTGRES_URL,
    prismaUrl: (): string | undefined => env().POSTGRES_PRISMA_URL,
    nonPoolingUrl: (): string | undefined => env().POSTGRES_URL_NON_POOLING,
  },

  auth: {
    jwtSecret: (): string | undefined => env().JWT_SECRET,
    jwtExpiresIn: (): string => env().JWT_EXPIRES_IN,
  },

  redis: {
    url: (): string | undefined =>
      env().REDIS_URL || env().UPSTASH_REDIS_REST_URL,
    token: (): string | undefined =>
      env().UPSTASH_REDIS_REST_TOKEN || env().REDIS_TOKEN,
  },

  ai: {
    openAiKey: (): string | undefined => env().OPENAI_API_KEY,
    openAiBaseUrl: (): string | undefined => env().OPENAI_BASE_URL,
    anthropicApiKey: (): string | undefined => env().ANTHROPIC_API_KEY,
    togetherApiKey: (): string | undefined => env().TOGETHER_API_KEY,
    jigsawstackApiKey: (): string | undefined => env().JIGSAWSTACK_API_KEY,
    googleApiKey: (): string | undefined => env().GOOGLE_API_KEY,
    replicateToken: (): string | undefined => env().REPLICATE_API_TOKEN,

    // Azure OpenAI
    azureOpenAiKey: (): string | undefined => env().AZURE_OPENAI_API_KEY,
    azureOpenAiEndpoint: (): string | undefined => env().AZURE_OPENAI_ENDPOINT,
    azureOpenAiApiVersion: (): string | undefined =>
      env().AZURE_OPENAI_API_VERSION,
    azureOpenAiDeploymentName: (): string | undefined =>
      env().AZURE_OPENAI_DEPLOYMENT_NAME,
  },

  azure: {
    // Storage
    storageConnectionString: (): string | undefined =>
      env().AZURE_STORAGE_CONNECTION_STRING,
    storageAccountName: (): string | undefined =>
      env().AZURE_STORAGE_ACCOUNT_NAME,
    storageAccountKey: (): string | undefined =>
      env().AZURE_STORAGE_ACCOUNT_KEY,
    storageContainerName: (): string | undefined =>
      env().AZURE_STORAGE_CONTAINER_NAME,

    // Authentication
    adClientId: (): string | undefined => env().AZURE_AD_CLIENT_ID,
    adClientSecret: (): string | undefined => env().AZURE_AD_CLIENT_SECRET,
    adTenantId: (): string | undefined => env().AZURE_AD_TENANT_ID,
  },

  monitoring: {
    sentryDsn: (): string | undefined => env().SENTRY_DSN,
    axiomDataset: (): string | undefined => env().AXIOM_DATASET,
    axiomToken: (): string | undefined => env().AXIOM_TOKEN,
    litlyxProjectId: (): string | undefined => env().VITE_LITLYX_PROJECT_ID,
    litlyxApiKey: (): string | undefined => env().VITE_LITLYX_API_KEY,
  },

  email: {
    from: (): string | undefined => env().EMAIL_FROM,
    resendApiKey: (): string | undefined => env().RESEND_API_KEY,
  },

  site: {
    url: (): string | undefined => env().SITE_URL,
  },

  security: {
    enableBruteForceProtection: (): boolean =>
      env().SECURITY_ENABLE_BRUTE_FORCE_PROTECTION,
    maxLoginAttempts: (): number => env().SECURITY_MAX_LOGIN_ATTEMPTS,
    accountLockoutDuration: (): number =>
      env().SECURITY_ACCOUNT_LOCKOUT_DURATION,
    apiAbuseThreshold: (): number => env().SECURITY_API_ABUSE_THRESHOLD,
    enableAlerts: (): boolean => env().SECURITY_ENABLE_ALERTS,
    encryption: {
      algorithm: (): string => env().ENCRYPTION_ALGORITHM,
      key: (): string | undefined => env().ENCRYPTION_KEY,
    },
    audit: {
      enabled: (): boolean => env().ENABLE_AUDIT_LOGGING,
      retentionDays: (): number => env().AUDIT_LOG_RETENTION_DAYS,
    },
  },

  rateLimiting: {
    maxRequests: (): number => env().RATE_LIMIT_MAX_REQUESTS,
    windowMs: (): number => env().RATE_LIMIT_WINDOW_MS,
  },

  logging: {
    console: (): boolean => env().LOG_CONSOLE,
    audit: (): boolean => env().LOG_AUDIT,
  },

  client: {
    apiUrl: (): string | undefined => env().VITE_API_URL,
    mongoCluster: (): string | undefined => env().VITE_MONGODB_CLUSTER,
    trainingWsUrl: (): string | undefined => env().PUBLIC_TRAINING_WS_URL,
    rybbitScriptUrl: (): string | undefined => env().PUBLIC_RYBBIT_SCRIPT_URL,
    rybbitSiteId: (): string | undefined => env().PUBLIC_RYBBIT_SITE_ID,
  },

  notifications: {
    vapidPublicKey: (): string | undefined => env().VAPID_PUBLIC_KEY,
    vapidPrivateKey: (): string | undefined => env().VAPID_PRIVATE_KEY,
    vapidSubject: (): string | undefined => env().VAPID_SUBJECT,
    slackWebhookUrl: (): string | undefined => env().SLACK_WEBHOOK_URL,
  },

  twilio: {
    accountSid: (): string | undefined => env().TWILIO_ACCOUNT_SID,
    authToken: (): string | undefined => env().TWILIO_AUTH_TOKEN,
    phoneNumber: (): string | undefined => env().TWILIO_PHONE_NUMBER,
  },

  mentalLLaMA: {
    apiKey: (): string | undefined => env().MENTALLAMA_API_KEY,
    endpointUrl7B: (): string | undefined => env().MENTALLAMA_ENDPOINT_URL_7B,
    endpointUrl13B: (): string | undefined => env().MENTALLAMA_ENDPOINT_URL_13B,
    defaultModelTier: (): '7B' | '13B' | undefined =>
      env().MENTALLAMA_DEFAULT_MODEL_TIER,
    enablePythonBridge: (): boolean | undefined =>
      env().MENTALLAMA_ENABLE_PYTHON_BRIDGE,
    pythonBridgeScriptPath: (): string | undefined =>
      env().MENTALLAMA_PYTHON_BRIDGE_SCRIPT_PATH,
  },
}

export default config
