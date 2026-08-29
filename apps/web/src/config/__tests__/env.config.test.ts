// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { config, env, getEnv } from '../env.config'

const originalEnv: Record<string, string | undefined> = {}

function snapshotEnv() {
  for (const key of Object.keys(originalEnv)) delete originalEnv[key]
  for (const key of Object.keys(process.env))
    originalEnv[key] = process.env[key]
}

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key]
  }
  for (const [key, val] of Object.entries(originalEnv)) {
    if (val === undefined) delete process.env[key]
    else process.env[key] = val
  }
}

function applyEnv(overrides: Record<string, string | undefined>) {
  for (const [key, val] of Object.entries(overrides)) {
    if (val === undefined) delete process.env[key]
    else process.env[key] = val
  }
}

beforeEach(() => {
  snapshotEnv()
  vi.restoreAllMocks()
})

afterEach(() => {
  restoreEnv()
})

describe('getEnv (stateless validation)', () => {
  it('applies schema defaults when keys are absent', () => {
    applyEnv({
      NODE_ENV: undefined,
      PORT: undefined,
      LOG_LEVEL: undefined,
      CI: undefined,
    })
    const result = getEnv()
    expect(result.NODE_ENV).toBe('development')
    expect(result.PORT).toBe(3000)
    expect(result.LOG_LEVEL).toBe('info')
    expect(result.ENABLE_RATE_LIMITING).toBe(true)
  })

  it('coerces and surfaces provided overrides', () => {
    applyEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      LOG_LEVEL: 'debug',
      CI: undefined,
    })
    const result = getEnv()
    expect(result.NODE_ENV).toBe('production')
    expect(result.PORT).toBe(8080)
    expect(result.LOG_LEVEL).toBe('debug')
  })

  it('throws on an invalid NODE_ENV enum value', () => {
    applyEnv({ NODE_ENV: 'staging' })
    expect(() => getEnv()).toThrow()
  })

  it('throws on an invalid LOG_LEVEL enum value', () => {
    applyEnv({ NODE_ENV: 'development', LOG_LEVEL: 'trace' })
    expect(() => getEnv()).toThrow()
  })
})

describe('getEnv secret masking', () => {
  it('masks secret values and logs the env dump when CI is set', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    applyEnv({
      CI: 'true',
      NODE_ENV: 'production',
      MY_SECRET: 'supersecret',
      DATABASE_URL: 'postgres://user:pass@host/db',
    })
    getEnv()
    expect(logSpy).toHaveBeenCalledTimes(1)
    const logged = logSpy.mock.calls[0][1] as Record<string, unknown>
    expect(logged['MY_SECRET']).toBe('[hidden]')
    expect(logged['DATABASE_URL']).toBe('[hidden]')
    expect(logged['NODE_ENV']).toBe('production')
  })

  it('does not dump env when neither CI nor production is set', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    applyEnv({ CI: undefined, NODE_ENV: 'development' })
    getEnv()
    expect(logSpy).not.toHaveBeenCalled()
  })

  describe('maskEnv patterns and passthrough', () => {
    it('masks secret/token/dsn keys, passes through safe keys, hides unknown keys', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      applyEnv({
        CI: 'true',
        NODE_ENV: 'production',
        REDIS_TOKEN: 'rt',
        AXIOM_TOKEN: 'at',
        SITE_URL: 'https://x',
        PUBLIC_WIDGET: 'w',
        SOME_RANDOM_KEY: 'value',
      })
      getEnv()
      const logged = logSpy.mock.calls[0][1] as Record<string, unknown>
      expect(logged['REDIS_TOKEN']).toBe('[hidden]')
      expect(logged['AXIOM_TOKEN']).toBe('[hidden]')
      expect(logged['SITE_URL']).toBe('https://x')
      expect(logged['PUBLIC_WIDGET']).toBe('w')
      expect(logged['SOME_RANDOM_KEY']).toBe('[hidden]')
    })

    it('passes through null/undefined values unchanged (best-effort)', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      applyEnv({ CI: 'true', NODE_ENV: 'production' })
      let injected = false
      try {
        Object.defineProperty(process.env, 'NULL_VAL', {
          value: undefined,
          enumerable: true,
          configurable: true,
        })
        injected = true
      } catch {
        injected = false
      }
      getEnv()
      if (injected) {
        const logged = logSpy.mock.calls[0][1] as Record<string, unknown>
        if ('NULL_VAL' in logged) {
          expect(logged['NULL_VAL']).toBeUndefined()
        }
      }
    })
  })
})

describe('config object getters', () => {
  // Prime the single shared env() cache with a known environment by setting
  // the values before the first config getter is invoked.
  beforeEach(() => {
    // NODE_ENV=production drives this shared, memoized env() cache. All schema
    // fields are optional or defaulted, so deleting the optional credentials
    // below guarantees they resolve to `undefined` (no zod throw) and makes
    // every getter assertion deterministic regardless of the host environment.
    applyEnv({
      NODE_ENV: 'production',
      PORT: '4000',
      LOG_LEVEL: 'warn',
      ENABLE_RATE_LIMITING: 'false',
      REDIS_URL: 'redis://primary',
      UPSTASH_REDIS_REST_URL: 'https://upstash.example',
      UPSTASH_REDIS_REST_TOKEN: undefined,
      REDIS_TOKEN: undefined,
      SECURITY_MAX_LOGIN_ATTEMPTS: '7',
      SECURITY_ENABLE_ALERTS: 'false',
      AUDIT_LOG_RETENTION_DAYS: '90',
      ENCRYPTION_ALGORITHM: 'aes-256-gcm',
      // Optional credentials explicitly cleared so getters report undefined.
      JWT_SECRET: undefined,
      MONGODB_URI: undefined,
      ANTHROPIC_API_KEY: undefined,
      MONGODB_DB_NAME: undefined,
      MONGODB_USERNAME: undefined,
      MONGODB_PASSWORD: undefined,
      MONGODB_CLUSTER: undefined,
      POSTGRES_URL: undefined,
      POSTGRES_PRISMA_URL: undefined,
      POSTGRES_URL_NON_POOLING: undefined,
      LLM_API_KEY: undefined,
      LLM_BASE_URL: undefined,
      LLM_API_URL: undefined,
      OPENAI_API_KEY: undefined,
      OPENAI_BASE_URL: undefined,
      JIGSAWSTACK_API_KEY: undefined,
      GOOGLE_API_KEY: undefined,
      REPLICATE_API_TOKEN: undefined,
      AZURE_OPENAI_API_KEY: undefined,
      AZURE_OPENAI_ENDPOINT: undefined,
      AZURE_OPENAI_API_VERSION: undefined,
      AZURE_OPENAI_DEPLOYMENT_NAME: undefined,
      AZURE_STORAGE_CONNECTION_STRING: undefined,
      AZURE_STORAGE_ACCOUNT_NAME: undefined,
      AZURE_STORAGE_ACCOUNT_KEY: undefined,
      AZURE_STORAGE_CONTAINER_NAME: undefined,
      AZURE_AD_CLIENT_ID: undefined,
      AZURE_AD_CLIENT_SECRET: undefined,
      AZURE_AD_TENANT_ID: undefined,
      SENTRY_DSN: undefined,
      AXIOM_DATASET: undefined,
      AXIOM_TOKEN: undefined,
      VITE_LITLYX_PROJECT_ID: undefined,
      VITE_LITLYX_API_KEY: undefined,
      EMAIL_FROM: undefined,
      RESEND_API_KEY: undefined,
      SITE_URL: undefined,
      ENCRYPTION_KEY: undefined,
      VITE_API_URL: undefined,
      VITE_MONGODB_CLUSTER: undefined,
      PUBLIC_TRAINING_WS_URL: undefined,
      PUBLIC_UMAMI_SCRIPT_URL: undefined,
      PUBLIC_UMAMI_WEBSITE_ID: undefined,
      VAPID_PUBLIC_KEY: undefined,
      VAPID_PRIVATE_KEY: undefined,
      VAPID_SUBJECT: undefined,
      SLACK_WEBHOOK_URL: undefined,
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_PHONE_NUMBER: undefined,
      MENTALLAMA_API_KEY: undefined,
      MENTALLAMA_ENDPOINT_URL_7B: undefined,
      MENTALLAMA_ENDPOINT_URL_13B: undefined,
      MENTALLAMA_DEFAULT_MODEL_TIER: undefined,
      MENTALLAMA_ENABLE_PYTHON_BRIDGE: undefined,
      MENTALLAMA_PYTHON_BRIDGE_SCRIPT_PATH: undefined,
      // Defaulted keys cleared so assertions on their *default* values are
      // deterministic (the host environment leaks some, e.g. RATE_LIMIT_WINDOW_MS).
      ANALYTICS_WS_PORT: undefined,
      NOTIFICATION_WS_PORT: undefined,
      JWT_EXPIRES_IN: undefined,
      SECURITY_ENABLE_BRUTE_FORCE_PROTECTION: undefined,
      SECURITY_ACCOUNT_LOCKOUT_DURATION: undefined,
      SECURITY_API_ABUSE_THRESHOLD: undefined,
      ENABLE_AUDIT_LOGGING: undefined,
      RATE_LIMIT_MAX_REQUESTS: undefined,
      RATE_LIMIT_WINDOW_MS: undefined,
      LOG_CONSOLE: undefined,
      LOG_AUDIT: undefined,
    })
  })

  it('reports environment flags from NODE_ENV', () => {
    expect(config.isProduction()).toBe(true)
    expect(config.isDevelopment()).toBe(false)
    expect(config.isTest()).toBe(false)
  })

  it('exposes server config derived from env', () => {
    expect(config.server.port()).toBe(4000)
    expect(config.server.logLevel()).toBe('warn')
    expect(config.server.enableRateLimiting()).toBe(false)
  })

  it('prefers REDIS_URL and leaves token undefined when unset', () => {
    expect(config.redis.url()).toBe('redis://primary')
    expect(config.redis.token()).toBeUndefined()
  })

  it('exposes security configuration values', () => {
    expect(config.security.maxLoginAttempts()).toBe(7)
    expect(config.security.enableAlerts()).toBe(false)
    expect(config.security.audit.retentionDays()).toBe(90)
    expect(config.security.encryption.algorithm()).toBe('aes-256-gcm')
  })

  it('returns undefined for optional credentials that are unset', () => {
    expect(config.auth.jwtSecret()).toBeUndefined()
    expect(config.database.mongoUri()).toBeUndefined()
    expect(config.ai.anthropicApiKey()).toBeUndefined()
  })

  it('exposes worker websocket port defaults', () => {
    expect(config.workers.analytics.wsPort()).toBe(8083)
    expect(config.workers.notification.wsPort()).toBe(8082)
  })

  it('returns undefined for all optional database credentials', () => {
    expect(config.database.mongoUri()).toBeUndefined()
    expect(config.database.mongoDbName()).toBeUndefined()
    expect(config.database.mongoUsername()).toBeUndefined()
    expect(config.database.mongoPassword()).toBeUndefined()
    expect(config.database.mongoCluster()).toBeUndefined()
    expect(config.database.url()).toBeUndefined()
    expect(config.database.prismaUrl()).toBeUndefined()
    expect(config.database.nonPoolingUrl()).toBeUndefined()
  })

  it('returns the JWT expires-in default when unset', () => {
    expect(config.auth.jwtSecret()).toBeUndefined()
    expect(config.auth.jwtExpiresIn()).toBe('24h')
  })

  it('returns undefined for all optional AI provider credentials', () => {
    expect(config.ai.llmApiKey()).toBeUndefined()
    expect(config.ai.llmBaseUrl()).toBeUndefined()
    expect(config.ai.openAiKey()).toBeUndefined()
    expect(config.ai.openAiBaseUrl()).toBeUndefined()
    expect(config.ai.anthropicApiKey()).toBeUndefined()
    expect(config.ai.jigsawstackApiKey()).toBeUndefined()
    expect(config.ai.googleApiKey()).toBeUndefined()
    expect(config.ai.replicateToken()).toBeUndefined()
    expect(config.ai.azureOpenAiKey()).toBeUndefined()
    expect(config.ai.azureOpenAiEndpoint()).toBeUndefined()
    expect(config.ai.azureOpenAiApiVersion()).toBeUndefined()
    expect(config.ai.azureOpenAiDeploymentName()).toBeUndefined()
  })

  it('returns undefined for all optional Azure storage/AD credentials', () => {
    expect(config.azure.storageConnectionString()).toBeUndefined()
    expect(config.azure.storageAccountName()).toBeUndefined()
    expect(config.azure.storageAccountKey()).toBeUndefined()
    expect(config.azure.storageContainerName()).toBeUndefined()
    expect(config.azure.adClientId()).toBeUndefined()
    expect(config.azure.adClientSecret()).toBeUndefined()
    expect(config.azure.adTenantId()).toBeUndefined()
  })

  it('returns undefined for all optional monitoring credentials', () => {
    expect(config.monitoring.sentryDsn()).toBeUndefined()
    expect(config.monitoring.axiomDataset()).toBeUndefined()
    expect(config.monitoring.axiomToken()).toBeUndefined()
    expect(config.monitoring.litlyxProjectId()).toBeUndefined()
    expect(config.monitoring.litlyxApiKey()).toBeUndefined()
  })

  it('returns undefined for optional email credentials', () => {
    expect(config.email.from()).toBeUndefined()
    expect(config.email.resendApiKey()).toBeUndefined()
  })

  it('returns undefined for an unset site url', () => {
    expect(config.site.url()).toBeUndefined()
  })

  it('exposes security defaults for unset optional values', () => {
    expect(config.security.enableBruteForceProtection()).toBe(true)
    expect(config.security.accountLockoutDuration()).toBe(1800)
    expect(config.security.apiAbuseThreshold()).toBe(100)
    expect(config.security.audit.enabled()).toBe(true)
    expect(config.security.encryption.key()).toBeUndefined()
  })

  it('exposes rate limiting defaults', () => {
    expect(config.rateLimiting.maxRequests()).toBe(100)
    expect(config.rateLimiting.windowMs()).toBe(900000)
  })

  it('exposes logging flag defaults', () => {
    expect(config.logging.console()).toBe(true)
    expect(config.logging.audit()).toBe(true)
  })

  it('returns undefined for all optional client credentials', () => {
    expect(config.client.apiUrl()).toBeUndefined()
    expect(config.client.mongoCluster()).toBeUndefined()
    expect(config.client.trainingWsUrl()).toBeUndefined()
    expect(config.client.umamiScriptUrl()).toBeUndefined()
    expect(config.client.umamiWebsiteId()).toBeUndefined()
  })

  it('returns undefined for all optional notification credentials', () => {
    expect(config.notifications.vapidPublicKey()).toBeUndefined()
    expect(config.notifications.vapidPrivateKey()).toBeUndefined()
    expect(config.notifications.vapidSubject()).toBeUndefined()
    expect(config.notifications.slackWebhookUrl()).toBeUndefined()
  })

  it('returns undefined for all optional twilio credentials', () => {
    expect(config.twilio.accountSid()).toBeUndefined()
    expect(config.twilio.authToken()).toBeUndefined()
    expect(config.twilio.phoneNumber()).toBeUndefined()
  })

  it('returns undefined for all optional MentalLLaMA credentials', () => {
    expect(config.mentalLLaMA.apiKey()).toBeUndefined()
    expect(config.mentalLLaMA.endpointUrl7B()).toBeUndefined()
    expect(config.mentalLLaMA.endpointUrl13B()).toBeUndefined()
    expect(config.mentalLLaMA.defaultModelTier()).toBeUndefined()
    expect(config.mentalLLaMA.enablePythonBridge()).toBeUndefined()
    expect(config.mentalLLaMA.pythonBridgeScriptPath()).toBeUndefined()
  })
})

describe('env() memoization', () => {
  it('returns the same memoized instance on repeated calls', () => {
    expect(env()).toBe(env())
  })
})

describe('maskEnv secret/safe pattern coverage', () => {
  it('hides keys matching secret patterns and passes through safe/unknown handling', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    applyEnv({
      CI: 'true',
      NODE_ENV: 'production',
      // --- secret patterns (value should be masked) ---
      MY_API_KEY: 'a', // ends in KEY$
      DB_PASSWORD: 'b', // contains PASSWORD
      PRIVATE_KEY: 'c', // contains PRIVATE and ends in KEY$
      APP_DSN: 'd', // ends in DSN$
      MY_TOKEN: 'e', // contains TOKEN
      AXIOM_TOKEN: 'f', // explicit AXIOM_TOKEN
      MY_SECRET: 'g', // contains SECRET
      REDIS_URL: 'h', // explicit REDIS_URL
      DATABASE_URL: 'i', // explicit DATABASE_URL
      MONGODB_URI: 'j', // explicit MONGODB_URI
      SENTRY_DSN: 'https://sentry.example.com/1', // explicit SENTRY_DSN (valid url)
      // --- safe patterns (value should pass through) ---
      PUBLIC_FLAG: 'pub', // starts with PUBLIC_
      PORT: '3000', // explicit PORT
      LOG_LEVEL: 'info', // explicit LOG_LEVEL
      SITE_URL: 'https://example.com', // explicit SITE_URL
      // --- unknown key (should be hidden) ---
      SOME_RANDOM_KEY: 'z',
    })
    getEnv()
    const logged = logSpy.mock.calls[0][1] as Record<string, unknown>
    // secret -> [hidden]
    expect(logged['MY_API_KEY']).toBe('[hidden]')
    expect(logged['DB_PASSWORD']).toBe('[hidden]')
    expect(logged['PRIVATE_KEY']).toBe('[hidden]')
    expect(logged['APP_DSN']).toBe('[hidden]')
    expect(logged['MY_TOKEN']).toBe('[hidden]')
    expect(logged['AXIOM_TOKEN']).toBe('[hidden]')
    expect(logged['MY_SECRET']).toBe('[hidden]')
    expect(logged['REDIS_URL']).toBe('[hidden]')
    expect(logged['DATABASE_URL']).toBe('[hidden]')
    expect(logged['MONGODB_URI']).toBe('[hidden]')
    expect(logged['SENTRY_DSN']).toBe('[hidden]')
    // safe -> passthrough
    expect(logged['PUBLIC_FLAG']).toBe('pub')
    expect(logged['PORT']).toBe('3000')
    expect(logged['LOG_LEVEL']).toBe('info')
    expect(logged['SITE_URL']).toBe('https://example.com')
    // unknown -> [hidden]
    expect(logged['SOME_RANDOM_KEY']).toBe('[hidden]')
  })
})

describe('maskEnv null/undefined passthrough', () => {
  // Node's process.env proxy coerces every value to a string, so a *real*
  // undefined/null value cannot be injected through it. We stub process.env
  // with a plain object that can actually hold undefined/null values to
  // exercise maskEnv's `v === undefined || v === null ? v` branch.
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('passes null and undefined values through unchanged', () => {
    vi.stubGlobal('process', {
      env: {
        CI: 'true',
        NODE_ENV: 'production',
        NULL_VAL: undefined,
        NULLISH: null,
        MY_SECRET: 'x',
        PUBLIC_FLAG: 'y',
        SOME_RANDOM: 'z',
      },
    })
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      getEnv()
    } catch {
      // parse result is irrelevant for the masking assertion
    }
    expect(logSpy).toHaveBeenCalled()
    const logged = logSpy.mock.calls[0][1] as Record<string, unknown>
    expect(logged['NULL_VAL']).toBeUndefined()
    expect(logged['NULLISH']).toBeNull()
    // secret still masked, safe passed through, unknown hidden
    expect(logged['MY_SECRET']).toBe('[hidden]')
    expect(logged['PUBLIC_FLAG']).toBe('y')
    expect(logged['SOME_RANDOM']).toBe('[hidden]')
  })
})

// NOTE: The `import.meta.env` else-branch of getEnv (env.config.ts:93) is
// intentionally NOT exercised here. Reaching it requires `typeof process ===
// 'undefined'`, but vitest defines `process` as a global getter in both its
// node and jsdom environments, so that branch is unreachable under vitest
// without a non-Node/SSR runtime. The null/undefined `maskEnv` branch above is
// covered via a stubbed `process.env` plain object instead.
