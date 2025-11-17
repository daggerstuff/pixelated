import * as Sentry from '@sentry/astro'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    'https://ef4ca2c0d2530a95efb0ef55c168b661@o4509483611979776.ingest.us.sentry.io/4509483637932032',

  tracesSampleRate: Number(
    process.env.SENTRY_TRACES_SAMPLE_RATE ??
    (process.env.NODE_ENV === 'development' ? 1.0 : 0.1),
  ),
  profilesSampleRate: Number(
    process.env.SENTRY_PROFILES_SAMPLE_RATE ??
    (process.env.NODE_ENV === 'development' ? 0.2 : 0.05),
  ),

  integrations: [nodeProfilingIntegration()],

  sendDefaultPii: true,

  debug: process.env.SENTRY_DEBUG === '1',

  environment: process.env.NODE_ENV || 'production',

  // Prioritize SENTRY_RELEASE (set in CI/CD) over package version for proper release tracking
  release:
    process.env.SENTRY_RELEASE ||
    process.env.npm_package_version ||
    '0.0.1',

  beforeSend(event) {
    if (event.request?.url?.includes('/api/health')) {
      return null
    }

    if (event.request?.headers?.['user-agent']?.includes('AlwaysOn')) {
      return null
    }

    if (event.exception?.values?.[0]?.value?.includes('ENOTFOUND')) {
      return null
    }

    return event
  },

  initialScope: {
    tags: {
      component: 'astro-server',
      platform: 'self-hosted',
    },
    context: {
      app: {
        name: 'Pixelated Empathy',
        version: process.env.npm_package_version || '0.0.1',
      },
      runtime: {
        name: 'node',
        version: process.version,
      },
    },
  },
})
// Sentry debug ID assignment for better error tracking
const runtimeContext =
  typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
      ? global
      : typeof globalThis !== 'undefined'
        ? globalThis
        : typeof self !== 'undefined'
          ? self
          : null

  ; (() => {
    try {
      const context = runtimeContext ?? {}
      const errorCtor = context.Error || Error
      const n = new errorCtor().stack
      if (n) {
        context._sentryDebugIds = context._sentryDebugIds || {}
        context._sentryDebugIds[n] = '40958e06-4933-5d4d-8c5f-d969f7ba8976'
      }
    } catch (err) {
      // Handle error: log only in development to avoid leaking info in production
      if (process?.env?.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('Sentry debugId assignment failed:', err)
      }
    }
  })()
