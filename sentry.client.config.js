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
      // Disable automatic session replay recording. Switch to manual control only.
      // We'll keep the integration present but set sampling to 0 so replays are not
      // recorded automatically. Call SentryReplay.startRecording() (or equivalent)
      // from application code when a manual recording is desired.
      replayIntegration({
        sessionSampleRate: 0,
        errorSampleRate: 0,
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
