/// <reference types="astro/client" />
import * as Sentry from '@sentry/browser'
import * as LaunchDarkly from 'launchdarkly-js-client-sdk'

import { initSentry } from '@/lib/sentry/config'

let sentryInitialised = false
let ldClient: LaunchDarkly.LDClient | null = null

if (typeof window !== 'undefined' && !sentryInitialised) {
  const sentryConfig = initSentry({
    // Remove Spotlight from default integrations to avoid noisy dev warnings
    integrations: (defaultIntegrations: Array<{ name?: string }> = []) => {
      // Optionally add Sentry.launchDarklyIntegration() if available:
      const base = defaultIntegrations.filter(
        (integration) => integration && integration.name !== 'Spotlight'
      )
      // Use dynamic property to avoid breaking if not present
      if (typeof (Sentry as any).launchDarklyIntegration === 'function') {
        base.push((Sentry as any).launchDarklyIntegration())
      }
      return base
    },
  })

  Sentry.init(sentryConfig)
  sentryInitialised = true

  // Initialize LaunchDarkly for feature flagging; use env/config abstraction in real code
  ldClient = LaunchDarkly.initialize(
    import.meta.env.PUBLIC_LD_CLIENT_ID || '', // Place real key in environment abstraction
    { kind: 'user', key: import.meta.env.PUBLIC_LD_USER_KEY || '' },
    {
      inspectors: [
        typeof (Sentry as any).buildLaunchDarklyFlagUsedHandler === 'function'
          ? (Sentry as any).buildLaunchDarklyFlagUsedHandler()
          : undefined,
      ].filter(Boolean),
    }
  )

  // Demo: Evaluate a flag and capture a Sentry exception after client is ready
  ldClient?.on('ready', () => {
    // Simple one-shot test, opt-in during development
    /* Uncomment to test
    const flagValue = ldClient?.variation('test-flag', false)
    Sentry.captureException(new Error('Something went wrong!'))
    */
  })
}

export default function SentryInit() {
  return null // runs once on the client to bootstrap Sentry/LD
}
