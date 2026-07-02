import handler from '@astrojs/cloudflare/entrypoints/server'
import * as Sentry from '@sentry/cloudflare'
import type { CloudflareOptions } from '@sentry/cloudflare'

export default Sentry.withSentry(
  (env): CloudflareOptions =>
    ({
      dsn: env.SENTRY_DSN as string | undefined,
      // Define how likely traces are sampled. Adjust this value in production,
      // or use tracesSampler for greater control.
      tracesSampleRate: 1.0,
    }) as CloudflareOptions,
  handler,
)
