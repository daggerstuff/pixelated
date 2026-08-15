import { isSyntheticSentryTestEvent } from './sentry-event-filter.mjs'

// instrument.mjs — Comprehensive Sentry Node.js instrumentation for production builds
try {
  await import('dotenv/config')
} catch (e) {
  // Ignore missing dotenv in environments where it is not installed
}

const createStubSpan = () => ({
  end: () => {},
})

const createStubScope = () => ({
  setTag: () => {},
  setExtra: () => {},
  setUser: () => {},
})

/** @typedef {{ end: () => void }} SentrySpan */
/** @typedef {{ data?: unknown }} SentryRequest */
/** @typedef {{ request?: SentryRequest, message?: unknown, exception?: { values?: unknown } }} SentryEvent */
/** @typedef {{ category?: string; level?: string; [key: string]: unknown }} SentryBreadcrumb */
/** @typedef {{ setTags: (tags: Record<string, string>) => void; setExtras: (extras: Record<string, unknown>) => void; setUser: (user: SentryUser) => void }} SentryScope */
/** @typedef {{ id?: string; email?: string; username?: string }} SentryUser */
/** @typedef {{ [key: string]: string | number | boolean | null | Record<string, unknown> | unknown[] }} PrimitiveValue */
/** @typedef {{ id?: string; op: string; [key: string]: unknown }} SentrySpanOptions */
/** @typedef {(options?: { tracing?: boolean }) => unknown} HttpIntegrationFactory */
/** @typedef {() => unknown} BasicIntegrationFactory */
/** @typedef {{ count: (name: string, value: number, options?: { attributes?: Record<string, unknown> }) => void, distribution: (name: string, value: number, options?: { attributes?: Record<string, unknown> }) => void }} SentryMetrics */
/** @typedef {(error: unknown) => void} CaptureHandler */
/** @typedef {{ category?: string; [key: string]: unknown }} EventData */
/** @typedef {{ startInactiveSpan: (options: SentrySpanOptions) => SentrySpan, startSpan: (options: SentrySpanOptions) => SentrySpan }} SentrySpanFactory */
/** @typedef {() => Promise<unknown>} QueryFunction */
/** @typedef {string | QueryFunction} DatabaseQueryInput */
/** @typedef {{
  init: (options: Record<string, unknown>) => void
  close: () => Promise<void> | void
  captureException: CaptureHandler
  setUser: (user: SentryUser | null) => void
  setContext: (key: string, context: EventData) => void
  withScope: (callback: (scope: SentryScope) => void) => void
  startInactiveSpan: (options: SentrySpanOptions) => SentrySpan
  startSpan: (options: SentrySpanOptions) => SentrySpan
  metrics: SentryMetrics
  setTag?: (key: string, value: string) => void
  setExtra?: (key: string, value: unknown) => void
}} SentryLike */
/** @typedef {{ [key: string]: unknown }} PrimitiveValueRecord */
/** @typedef {{ tags?: Record<string, string>; extra?: PrimitiveValueRecord; user?: SentryUser }} CaptureErrorContext */
/** @typedef {ReturnType<typeof createStubSentry>} SentryStub */
/** @typedef {SentryLike & SentryStub} SentryInstance */
/** @typedef {{ user?: SentryUser }} SentryRequestLike */
/** @typedef {(error?: unknown) => void} NextHandler */

const createStubSentry = () => ({
  init: () => {},
  close: async () => {},
  captureException: (_err) => {},
  setUser: (_user) => {},
  setContext: (_key, _context) => {},
  withScope: (callback = (_scope) => {}) => {
    try {
      callback(createStubScope())
    } catch {
      // ignore — noop scope wrapper
    }
  },
  startInactiveSpan: (_options) => createStubSpan(),
  startSpan: (_options) => createStubSpan(),
  metrics: {
    count: (_name, _value, _options) => {},
    distribution: (_name, _value, _options) => {},
  },
})

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** @param {unknown} value @returns {value is SentryBreadcrumb} */
const isSentryBreadcrumb = (value) =>
  isRecord(value) &&
  (value.category === undefined || typeof value.category === 'string') &&
  (value.level === undefined || typeof value.level === 'string')

/** @param {unknown} value @returns {value is SentryInstance} */
const isSentryInstance = (value) =>
  value !== null &&
  typeof value === 'object' &&
  typeof value.init === 'function' &&
  typeof value.close === 'function' &&
  typeof value.captureException === 'function' &&
  typeof value.setUser === 'function' &&
  typeof value.setContext === 'function' &&
  typeof value.withScope === 'function' &&
  typeof value.startInactiveSpan === 'function' &&
  typeof value.startSpan === 'function' &&
  typeof value.metrics === 'object'

/**
 * @param {SentryEvent | null | undefined} event
 * @param {readonly string[]} fields
 * @returns {SentryEvent | null | undefined}
 */
const filterSensitiveFields = (event, fields) => {
  if (
    !isRecord(event) ||
    !isRecord(event.request) ||
    !isRecord(event.request.data)
  ) {
    return event
  }

  const requestData = /** @type {Record<string, unknown>} */ ({
    ...event.request.data,
  })
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(requestData, field)) {
      requestData[field] = '[FILTERED]'
    }
  }

  event.request.data = requestData
  return event
}

/** @type {SentryInstance} */
let Sentry = createStubSentry()
/** @type {BasicIntegrationFactory} */
let nodeProfilingIntegration = () => null
/** @type {HttpIntegrationFactory} */
let httpIntegration = () => null
/** @type {BasicIntegrationFactory} */
let expressIntegration = () => null

const SUPPORTED_PROFILING_NODE_MAJORS = new Set([16, 18, 20, 22, 24])

const resolveSentryDsn = () =>
  process.env.SENTRY_DSN ??
  process.env.PUBLIC_SENTRY_DSN ??
  process.env.SENTRY_PUBLIC_DSN ??
  process.env.VITE_SENTRY_DSN

const getNodeMajorVersion = () => {
  try {
    const [major = ''] = process.versions.node.split('.')
    const parsed = Number.parseInt(major, 10)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

try {
  const sentryNode = await import('@sentry/node')
  if (isSentryInstance(sentryNode)) {
    Sentry = sentryNode
  }
  if (typeof sentryNode.httpIntegration === 'function') {
    httpIntegration = (options) => sentryNode.httpIntegration(options)
  }
  if (typeof sentryNode.expressIntegration === 'function') {
    expressIntegration = () => sentryNode.expressIntegration()
  }

  const nodeMajor = getNodeMajorVersion()
  const profilingSupported =
    nodeMajor !== null && SUPPORTED_PROFILING_NODE_MAJORS.has(nodeMajor)

  if (profilingSupported) {
    try {
      const profiling = await import('@sentry/profiling-node')
      if (typeof profiling.nodeProfilingIntegration === 'function') {
        nodeProfilingIntegration = () => profiling.nodeProfilingIntegration()
      }
    } catch (profilingError) {
      console.warn(
        `[Sentry Profiling] Failed to load profiling addon on Node.js ${process.version}. ` +
          'Ensure build tools are available to compile @sentry/profiling-node from source.',
        profilingError,
      )
    }
  } else {
    console.warn(
      `[Sentry Profiling] Node.js ${process.version} is not in the supported LTS list ` +
        '(16, 18, 20, 22, 24). Profiling integration will be disabled.',
    )
  }
} catch (error) {
  const message =
    '[Sentry] Node SDK not available — disabling instrumentation. Install @sentry/node to enable full telemetry.'
  if (process.env.NODE_ENV === 'production') {
    console.warn(message)
  } else {
    console.warn(message, error)
  }
  Sentry = createStubSentry()
}

const resolvedSentryDsn = resolveSentryDsn()
if (!resolvedSentryDsn && process.env.NODE_ENV === 'production') {
  console.warn(
    '[Sentry] No DSN found via SENTRY_DSN, PUBLIC_SENTRY_DSN, SENTRY_PUBLIC_DSN, or VITE_SENTRY_DSN; Sentry will not send events.',
  )
}

// Enhanced Sentry configuration with comprehensive instrumentation
Sentry.init({
  dsn: resolvedSentryDsn, // Must be set in environment
  environment: process.env.NODE_ENV ?? 'production',
  release:
    process.env.SENTRY_RELEASE ??
    process.env.PUBLIC_SENTRY_RELEASE ??
    process.env.PUBLIC_APP_VERSION ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.RENDER_GIT_COMMIT ??
    process.env.NETLIFY_COMMIT_REF ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.CI_COMMIT_SHA ??
    process.env['npm_package_version'],

  // Performance monitoring configuration
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
  profilesSampleRate:
    parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.1,

  // Integrations for comprehensive monitoring
  integrations: [
    // HTTP integration for outgoing requests
    httpIntegration({ tracing: true }),
    // Express integration for incoming requests
    expressIntegration(),
    // Profiling integration for performance monitoring
    nodeProfilingIntegration(),
  ].filter(Boolean),

  // Tracing configuration
  tracePropagationTargets: [
    // Add your frontend domains here for distributed tracing
    /^https:\/\/.*\.pixelatedempathy\.tech/,
    /^https:\/\/.*\.pixelatedempathy\.com/,
    'localhost',
    /^\//,
  ],

  // Before send hook for filtering sensitive data and dropping local dev errors
  beforeSend: (/** @type {SentryEvent | null} */ event) => {
    if (isSyntheticSentryTestEvent(event)) {
      return null
    }

    // Drop events originating from a local server (localhost / 127.0.0.1)
    // so that dev-only errors never appear in Sentry, regardless of which
    // NODE_ENV was set locally for testing.
    // Skip this filter if PUBLIC_SENTRY_ALLOW_LOCALHOST is set to '1' for testing.
    const allowLocalhost = process.env.PUBLIC_SENTRY_ALLOW_LOCALHOST === '1'
    if (!allowLocalhost && isRecord(event) && isRecord(event.request)) {
      const url = /** @type {Record<string, unknown>} */ (event.request).url
      if (typeof url === 'string') {
        try {
          const { hostname } = new URL(url)
          if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return null
          }
        } catch {
          // Ignore malformed URLs
        }
      }
    }

    // Filter out sensitive data from events
    return filterSensitiveFields(event, [
      'password',
      'token',
      'apiKey',
      'secret',
    ])
  },

  // Before breadcrumb hook for custom breadcrumb handling
  beforeBreadcrumb: (/** @type {unknown} */ breadcrumb) => {
    // Customize breadcrumbs as needed
    if (!isSentryBreadcrumb(breadcrumb)) {
      return {
        category: undefined,
        level: undefined,
      }
    }
    if (
      typeof breadcrumb.category === 'string' &&
      breadcrumb.category === 'console'
    ) {
      // Enhance console breadcrumbs with more context
      return {
        ...breadcrumb,
        level: breadcrumb.level ?? 'info',
      }
    }
    return breadcrumb
  },

  // Initial scope configuration
  initialScope: {
    tags: {
      service: 'pixelated-backend',
      version: process.env['npm_package_version'],
      node_version: process.version,
    },
  },
})

// Performance monitoring helpers
/** @param {string} name @param {string} operation */
export const startTransaction = (name, operation = 'function') => {
  return Sentry.startInactiveSpan({ name, op: operation })
}

/** @param {string} name @param {string} operation */
export const startSpan = (name, operation = 'function') => {
  return Sentry.startSpan({ name, op: operation })
}

// Error handling helpers
/** @param {unknown} error @param {CaptureErrorContext} context */
export const captureError = (error, context = {}) => {
  Sentry.withScope((rawScope) => {
    const scope = rawScope
    if (context.tags) {
      scope.setTags(context.tags)
    }
    if (context.extra) {
      scope.setExtras(context.extra)
    }
    if (context.user) {
      scope.setUser(context.user)
    }
    Sentry.captureException(error)
  })
}

// User context helper
/** @param {SentryUser} user */
export const setUserContext = (user) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    // Add any other relevant user fields
  })
}

// Custom metrics and monitoring using Sentry Metrics
// See: https://docs.sentry.io/platforms/javascript/guides/astro/metrics/
/** @param {string} name @param {number} value @param {Record<string, unknown>} tags */
export const recordMetric = (name, value = 1, tags = {}) => {
  // Use counter metrics for incrementing values (button clicks, jobs processed, etc.)
  Sentry.metrics.count(name, value, {
    attributes: tags,
  })
}

// Record a duration metric (for example, API response time in milliseconds)
/** @param {string} name @param {number} durationMs @param {Record<string, unknown>} tags */
export const recordDurationMetric = (name, durationMs, tags = {}) => {
  Sentry.metrics.distribution(name, durationMs, {
    unit: 'millisecond',
    attributes: tags,
  })
}

// Health check function for monitoring
export const healthCheck = () => {
  const transaction = Sentry.startSpan({ name: 'health-check', op: 'function' })
  try {
    // Add your health check logic here
    return { status: 'healthy', timestamp: new Date().toISOString() }
  } catch (caughtError) {
    Sentry.captureException(caughtError)
    const message =
      caughtError instanceof Error ? caughtError.message : String(caughtError)
    return {
      status: 'unhealthy',
      error: message,
      timestamp: new Date().toISOString(),
    }
  } finally {
    transaction.end()
  }
}

// Graceful shutdown handler
export const closeSentry = async () => {
  await Sentry.close()
}

// Middleware for Express.js applications
/** @param {SentryRequestLike} req @param {unknown} res @param {NextHandler} next */
export const sentryMiddleware = (req, res, next) => {
  // In Sentry 8+, the expressIntegration handles most of this automatically
  // if you use Sentry.setupExpressErrorHandler(app).
  // This manual middleware is kept for backward compatibility and custom tagging.
  Sentry.setUser(
    req.user
      ? {
          id: req.user.id,
          email: req.user.email,
        }
      : null,
  )

  next()
}

// Database instrumentation helper
export const instrumentDatabaseQuery = async (
  /** @type {DatabaseQueryInput} */
  query,
  operation = 'db.query',
) => {
  const spanName = typeof query === 'string' ? query : 'db.query'
  const span = Sentry.startSpan({ name: spanName, op: operation })
  try {
    // Your database query logic here
    const queryFn =
      typeof query === 'function'
        ? async () => {
            return query()
          }
        : async () => query
    return await queryFn()
  } catch (error) {
    Sentry.captureException(error)
    throw error
  } finally {
    span.end()
  }
}

// Export Sentry for direct access if needed
export { Sentry }

// Export additional utilities
export default {
  Sentry,
  startTransaction,
  startSpan,
  captureError,
  setUserContext,
  recordMetric,
  healthCheck,
  closeSentry,
  sentryMiddleware,
  instrumentDatabaseQuery,
}

// This file is intended for import at the very top of your backend entry point.
// If Sentry is not wanted, set SENTRY_DSN="" in config or remove import.
