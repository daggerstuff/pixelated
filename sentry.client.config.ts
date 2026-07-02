import * as Sentry from '@sentry/astro'

const env = import.meta.env as Record<string, string | undefined>

Sentry.init({
  dsn:
    env['PUBLIC_SENTRY_DSN'] ?? env['SENTRY_PUBLIC_DSN'] ?? env['SENTRY_DSN'],

  environment: import.meta.env.DEV ? 'development' : import.meta.env.MODE,

  // Define how likely traces are sampled. Adjust this value in production,
  // or use tracesSampler for greater control.
  tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.1,

  integrations: [
    // Browser tracing integration for performance monitoring
    Sentry.browserTracingIntegration(),
    // Session replay for error reproduction
    Sentry.replayIntegration(),
    // User feedback widget
    Sentry.feedbackIntegration({
      colorScheme: 'system',
    }),
  ],

  // Session replay sample rate
  replaysSessionSampleRate: 0.1,
  // Sample replays when an error occurs (always capture)
  replaysOnErrorSampleRate: 1.0,

  // Enable logs
  enableLogs: true,

  // Use import.meta.env.DEV as authoritative dev check
  debug: env['PUBLIC_SENTRY_DEBUG'] === '1',
})
