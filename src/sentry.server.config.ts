import { init as initServer } from '@sentry/astro'

import { initSentry, resolveSentryDsn } from '@/lib/sentry/config'

const serverConfig = initSentry({
  dsn: resolveSentryDsn(),
})

initServer(serverConfig)
