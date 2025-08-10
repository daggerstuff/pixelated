import * as Sentry from '@sentry/astro'
import {
  browserTracingIntegration,
  replayIntegration,
  feedbackIntegration,
} from '@sentry/browser'
import { initSentry } from './src/lib/sentry/config'

const sentryConfig = initSentry({
  // Remove the auto Spotlight integration (prevents noisy warnings if sidecar isn't running)
  integrations: (defaultIntegrations = []) => {
    const withoutSpotlight = defaultIntegrations.filter(
      (i) => i && i.name !== 'Spotlight'
    )
    return [
      ...withoutSpotlight,
      browserTracingIntegration(),
      replayIntegration({
        sessionSampleRate: 0.1,
        errorSampleRate: 1.0,
      }),
      feedbackIntegration({
        colorScheme: 'auto',
        showBranding: false,
      }),
    ]
  },

  initialScope: {
    tags: {
      component: 'astro-client',
    },
  },
})

Sentry.init(sentryConfig)
