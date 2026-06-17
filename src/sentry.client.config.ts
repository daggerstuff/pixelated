import { init as initClient } from '@sentry/astro'

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
  integrations: [],
})

try {
  initClient(clientConfig)
} catch (err) {
  console.warn(
    '[Sentry] Client init failed (CSP may be blocking inline script):',
    err,
  )
}

// React 19 Error Handler
// Export for use in entry points that call createRoot
// Usage: import { createRoot } from 'react-dom/client'
//        const root = createRoot(container, {
//          onUncaughtError: reactErrorHandler(),
//          onCaughtError: reactErrorHandler(),
//          onRecoverableError: reactErrorHandler(),
//        })
export const reactErrorHandler = () => {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const getWindowErrorHandler = (
    window as Window & { Sentry?: { reactErrorHandler?: () => unknown } }
  ).Sentry?.reactErrorHandler

  if (typeof getWindowErrorHandler === 'function') {
    try {
      const handler = getWindowErrorHandler()
      if (typeof handler === 'function') {
        return handler
      }
    } catch {
      // ignore and fall back to no-op
    }
  }

  if (import.meta.env.DEV) {
    return (error: unknown) => {
      console.error('[Sentry] reactErrorHandler fallback triggered:', error)
    }
  }

  return () => {}
}
