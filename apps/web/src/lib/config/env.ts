import { z } from 'zod'

/**
 * Centralized environment configuration with Zod validation.
 *
 * This module replaces raw `process.env` access across the codebase.
 * All env vars are validated at startup — no silent undefined values.
 *
 * Usage:
 *   import { config } from '@/lib/config/env'
 *   const port = config.port
 *   if (config.isDev) { ... }
 */

const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().optional(),
  DEPLOY_TARGET: z.string().optional(),

  // Database
  DATABASE_URL: z.string().optional(),
  THERAPEUTIC_DATABASE_URL: z.string().optional(),
  MONGODB_URI: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),
  THERAPEUTIC_REDIS_URL: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().optional(),
  JWT_EXPIRY: z.string().default('24h'),

  // CORS
  CORS_ORIGIN: z.string().default('*'),

  // API
  PIXELATED_API_KEY: z.string().optional(),
  PIXELATED_API_URL: z.string().url().optional(),

  // External API
  RISK_STRATIFICATION_API_URL: z.string().url().optional(),
  RISK_STRATIFICATION_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  // LLM
  LLM_PROVIDER: z.string().optional(),
  NIM_API_KEY: z.string().optional(),
  NIM_BASE_URL: z.string().url().optional(),
  TINKER_API_KEY: z.string().optional(),

  // Sentry / Monitoring
  SENTRY_DSN: z.string().optional(),
  PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),

  // Analytics
  PUBLIC_MIXPANEL_TOKEN: z.string().optional(),

  // AWS
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),

  // W&B
  WANDB_API_KEY: z.string().optional(),

  // Feature Flags
  FEATURE_AI_INSIGHTS: z.string().default('false'),
  FEATURE_APPROVAL_WORKFLOWS: z.string().default('false'),
  FEATURE_COLLABORATION: z.string().default('false'),
  FEATURE_VERSIONING: z.string().default('false'),

  // Rate Limiting
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('json'),

  // Audit
  ENABLE_AUDIT_LOGGING: z.string().default('false'),
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  // Encryption
  ENCRYPTION_ALGORITHM: z.string().default('aes-256-gcm'),
  ENCRYPTION_KEY: z.string().optional(),

  // Inference test
  RL_INFERENCE_TEST_MODELS: z.string().optional(),
})

export type EnvConfig = z.infer<typeof envSchema>

/**
 * Parse and validate environment variables.
 * In test mode, missing required vars are silently ignored.
 */
function parseEnv(): EnvConfig {
  const isTest = process.env.NODE_ENV === 'test'
  const result = envSchema.safeParse(process.env)
  if (result.success) {
    return result.data
  }
  if (isTest) {
    // In tests, log warnings but return defaults for any missing vars
    console.warn('[env] Config validation warnings (test mode):', result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
    return envSchema.parse({}) // all defaults
  }
  // In production/dev, fail fast on invalid config
  const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')
  throw new Error(`[env] Invalid environment configuration:\n${issues}`)
}

const parsed = parseEnv()

export const config = {
  // Runtime
  env: parsed.NODE_ENV,
  isDev: parsed.NODE_ENV === 'development',
  isProd: parsed.NODE_ENV === 'production',
  isTest: parsed.NODE_ENV === 'test',
  port: parsed.PORT,
  host: parsed.HOST ?? '0.0.0.0',
  deployTarget: parsed.DEPLOY_TARGET,

  // Database
  databaseUrl: parsed.DATABASE_URL,
  therapeuticDatabaseUrl: parsed.THERAPEUTIC_DATABASE_URL,
  mongodbUri: parsed.MONGODB_URI,

  // Redis
  redisUrl: parsed.REDIS_URL,
  therapeuticRedisUrl: parsed.THERAPEUTIC_REDIS_URL,

  // Auth
  jwtSecret: parsed.JWT_SECRET,
  jwtExpiry: parsed.JWT_EXPIRY,

  // CORS
  corsOrigin: parsed.CORS_ORIGIN,

  // API
  apiKey: parsed.PIXELATED_API_KEY,
  apiUrl: parsed.PIXELATED_API_URL,

  // External API
  riskApiUrl: parsed.RISK_STRATIFICATION_API_URL,
  riskTimeoutMs: parsed.RISK_STRATIFICATION_TIMEOUT_MS,

  // LLM
  llmProvider: parsed.LLM_PROVIDER,
  nimApiKey: parsed.NIM_API_KEY,
  nimBaseUrl: parsed.NIM_BASE_URL,
  tinkerApiKey: parsed.TINKER_API_KEY,

  // Sentry / Monitoring
  sentryDsn: parsed.SENTRY_DSN,
  publicSentryDsn: parsed.PUBLIC_SENTRY_DSN,
  sentryAuth: parsed.SENTRY_AUTH_TOKEN,
  sentryOrg: parsed.SENTRY_ORG,
  sentryProject: parsed.SENTRY_PROJECT,

  // Analytics
  mixpanelToken: parsed.PUBLIC_MIXPANEL_TOKEN,

  // AWS
  awsAccessKeyId: parsed.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: parsed.AWS_SECRET_ACCESS_KEY,
  awsRegion: parsed.AWS_REGION,

  // W&B
  wandbApiKey: parsed.WANDB_API_KEY,

  // Feature Flags (parsed as strings, consume with check)
  features: {
    aiInsights: parsed.FEATURE_AI_INSIGHTS === 'true',
    approvalWorkflows: parsed.FEATURE_APPROVAL_WORKFLOWS === 'true',
    collaboration: parsed.FEATURE_COLLABORATION === 'true',
    versioning: parsed.FEATURE_VERSIONING === 'true',
  },

  // Rate Limiting
  rateLimitMaxRequests: parsed.RATE_LIMIT_MAX_REQUESTS,
  rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,

  // Logging
  logLevel: parsed.LOG_LEVEL,
  logFormat: parsed.LOG_FORMAT,

  // Audit
  auditLoggingEnabled: parsed.ENABLE_AUDIT_LOGGING === 'true',
  auditLogRetentionDays: parsed.AUDIT_LOG_RETENTION_DAYS,

  // Encryption
  encryptionAlgorithm: parsed.ENCRYPTION_ALGORITHM,
  encryptionKey: parsed.ENCRYPTION_KEY,

  // Monitoring (backward compat)
  monitoring: {
    sentryDsn: parsed.SENTRY_DSN,
  },

  // Debug (backward compat)
  debug: parsed.NODE_ENV === 'development',
} as const

/**
 * Re-export the raw env schema for advanced use cases.
 */
export { envSchema }
