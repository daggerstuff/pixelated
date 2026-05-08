import { init as initClient } from '@sentry/astro'

import { initSentry, resolveSentryDsn } from '@/lib/sentry/config'

const clientDsn = resolveSentryDsn()

if (!clientDsn && import.meta.env.MODE === 'production') {
  console.warn(
    '[Sentry] Sentry DSN is missing. Client-side errors will not be sent.',
  )
}

const clientConfig = initSentry({
  // Force browser DSN to explicit public-only config so we don't silently
  // fall back to a fallback DSN and lose traceability.
  dsn: resolveSentryDsn(),
})

initClient(clientConfig)
