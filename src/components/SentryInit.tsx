'use client'

import * as Sentry from '@sentry/browser'

let sentryInitialised = false

if (!sentryInitialised) {
  Sentry.init({
    dsn: import.meta.env['PUBLIC_SENTRY_DSN'],
  })
  sentryInitialised = true
}

export default function SentryInit() {
  return null // runs once on the client to bootstrap Sentry
}
