/// <reference types="astro/client" />
import * as Sentry from '@sentry/browser'
import { initSentry } from '@/lib/sentry/config'


let sentryInitialised = false

if (!sentryInitialised) {
  Sentry.init(
    initSentry({
      // Remove Spotlight from default integrations to avoid noisy dev warnings
      integrations: (defaultIntegrations = []) =>
        defaultIntegrations.filter((i: any) => i && i.name !== 'Spotlight'),
    }) as any
  )
  sentryInitialised = true
}

export default function SentryInit() {
  return null // runs once on the client to bootstrap Sentry
}
