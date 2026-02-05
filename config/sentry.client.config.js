import * as Sentry from '@sentry/astro'
import {
  browserTracingIntegration,
  feedbackIntegration,
  replayIntegration,
} from '@sentry/astro'

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    'https://ef4ca2c0d2530a95efb0ef55c168b661@o4509483611979776.ingest.us.sentry.io/4509483637932032',

  environment: process.env.NODE_ENV || 'production',
  // Prioritize SENTRY_RELEASE (set in CI/CD) over package version for proper release tracking
  release:
    process.env.SENTRY_RELEASE ||
    process.env.PUBLIC_SENTRY_RELEASE ||
    process.env.PUBLIC_APP_VERSION ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.RENDER_GIT_COMMIT ||
    process.env.NETLIFY_COMMIT_REF ||
    process.env.RAILWAY_GIT_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.CI_COMMIT_SHA ||
    process.env.npm_package_version ||
    '0.0.1',

  tracesSampleRate: Number(
    process.env.SENTRY_TRACES_SAMPLE_RATE ??
    (process.env.NODE_ENV === 'development' ? 1.0 : 0.1),
  ),
  profilesSampleRate: Number(
    process.env.SENTRY_PROFILES_SAMPLE_RATE ??
    (process.env.NODE_ENV === 'development' ? 0.2 : 0.05),
  ),

  // Sentry Metrics (Beta) - enabled by default in SDK 10.28.2+
  // Reference: https://docs.sentry.io/platforms/javascript/guides/astro/metrics/
  // Set to false to disable metrics collection
  enableMetrics: process.env.SENTRY_ENABLE_METRICS !== 'false',

  // Optional: Filter or modify metrics before sending
  beforeSendMetric(metric) {
    // Drop metrics with sensitive data if needed
    if (metric.attributes?.dropMetric === true) {
      return null
    }
    // Add environment tag to all metrics
    metric.attributes = {
      ...metric.attributes,
      app_environment: process.env.NODE_ENV || 'production',
    }
    return metric
  },

  integrations: (defaultIntegrations) => {
    const withoutSpotlight = defaultIntegrations.filter((integration) => {
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
