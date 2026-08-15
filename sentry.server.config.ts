import { init as initServer } from '@sentry/astro'

import {
  initSentry,
  resolveSentryDsn,
  resolveSentryRelease,
} from '@/lib/sentry/config'

const serverConfig = initSentry({
  dsn: resolveSentryDsn(),
  release: resolveSentryRelease(),
})

// Cloudflare Workers use sentry.server.cloudflare.ts with @sentry/cloudflare wrapper
// via Sentry.withSentry(). Skip the @sentry/astro (Node-based) init to avoid
// importing Node-incompatible runtime modules in the Workers bundle.
if (import.meta.env['DEPLOY_TARGET'] !== 'cloudflare') {
  try {
    initServer(serverConfig)
  } catch (err) {
    console.warn('[Sentry] Server init failed:', err)
  }
}
