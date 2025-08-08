import * as Sentry from '@sentry/astro'
import { nodeProfilingIntegration } from '@sentry/profiling-node'

Sentry.init({
  dsn: process.env.SENTRY_DSN || "https://ef4ca2c0d2530a95efb0ef55c168b661@o4509483611979776.ingest.us.sentry.io/4509483637932032",

  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  profilesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  integrations: [nodeProfilingIntegration()],

  sendDefaultPii: true,

  debug: process.env.NODE_ENV === 'development',

  environment: process.env.NODE_ENV || 'production',

  release: process.env.npm_package_version || '0.0.1',

  beforeSend(event) {
    if (event.request?.url?.includes('/api/health')) {
      return null
    }

    if (event.request?.headers?.['user-agent']?.includes('AlwaysOn')) {
      return null
    }

    if (event.exception?.values?.[0]?.value?.includes('ENOTFOUND')) {
      return null
    }

    return event
  },

  initialScope: {
    tags: {
      component: 'astro-server',
      platform: 'aws',
    },
    context: {
      app: {
        name: 'Pixelated Empathy',
        version: process.env.npm_package_version || '0.0.1',
      },
      runtime: {
        name: 'node',
        version: process.version,
      },
    },
  },
})
