/// <reference types="astro/client" />
import * as Sentry from '@sentry/browser'

import { initSentry } from '@/lib/sentry/config'

let sentryInitialised = false

if (!sentryInitialised) {
  const sentryConfig = initSentry({
    // Remove Spotlight from default integrations to avoid noisy dev warnings
    integrations: (defaultIntegrations: Array<{ name?: string }> = []) =>
      defaultIntegrations.filter((integration) => integration && integration.name !== 'Spotlight'),
  })

  Sentry.init(sentryConfig)
  sentryInitialised = true
}

export default function SentryInit() {
  return null // runs once on the client to bootstrap Sentry
}
