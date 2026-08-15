import * as Sentry from '@sentry/astro'

import {
  initSentry,
  resolveSentryDsn,
  resolveSentryRelease,
} from '@/lib/sentry/config'

const clientDsn = resolveSentryDsn()

if (!clientDsn && import.meta.env.MODE === 'production') {
  console.warn(
    '[Sentry] Sentry DSN is missing. Client-side errors will not be sent.',
  )
}

const clientConfig = initSentry({
  dsn: resolveSentryDsn(),
  release: resolveSentryRelease(),
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
})

try {
  Sentry.init(clientConfig)
} catch (err) {
  console.warn(
    '[Sentry] Client init failed (CSP may be blocking inline script):',
    err,
  )
}
