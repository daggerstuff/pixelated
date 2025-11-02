import * as Sentry from '@sentry/astro'
import {
  browserTracingIntegration,
  replayIntegration,
  feedbackIntegration,
} from '@sentry/browser'

Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://ef4ca2c0d2530a95efb0ef55c168b661@o4509483611979776.ingest.us.sentry.io/4509483637932032',

  environment: process.env.NODE_ENV || 'production',
  release: process.env.npm_package_version || '0.0.1',

  tracesSampleRate: Number(
    process.env.SENTRY_TRACES_SAMPLE_RATE ??
      (process.env.NODE_ENV === 'development' ? 1.0 : 0.1),
  ),
  profilesSampleRate: Number(
    process.env.SENTRY_PROFILES_SAMPLE_RATE ??
      (process.env.NODE_ENV === 'development' ? 0.2 : 0.05),
  ),

  integrations: function (defaultIntegrations) {
    var withoutSpotlight = defaultIntegrations.filter(function (integration) {
      return integration && integration.name !== 'Spotlight'
    })
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

  sendDefaultPii: true,
  debug: process.env.SENTRY_DEBUG === '1',

  initialScope: {
    tags: {
      component: 'astro-client',
      platform: 'self-hosted',
    },
  },
})
