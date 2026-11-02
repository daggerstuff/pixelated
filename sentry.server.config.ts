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

// Cloudflare Workers builds set DEPLOY_TARGET=cloudflare. The @sentry/astro
// (Node-based) server init is skipped there so Node-only runtime modules stay
// out of the Workers bundle.
if (import.meta.env['DEPLOY_TARGET'] !== 'cloudflare') {
  try {
    initServer(serverConfig)
  } catch (err) {
    console.warn('[Sentry] Server init failed:', err)
  }
}
