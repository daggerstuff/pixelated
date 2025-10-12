import * as Sentry from '@sentry/astro'
import {
  browserTracingIntegration,
  replayIntegration,
  feedbackIntegration,
} from '@sentry/browser'
import { initSentry } from './src/lib/sentry/config'

const sentryConfig = initSentry({
  integrations: (defaultIntegrations) => {
    const withoutSpotlight = defaultIntegrations.filter(
      (integration) => integration && integration.name !== 'Spotlight'
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
      platform: 'self-hosted',
    },
  },
})

Sentry.init(sentryConfig)
