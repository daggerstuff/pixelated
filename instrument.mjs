// Import Sentry for ESM
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://ef4ca2c0d2530a95efb0ef55c168b661@o4509483611979776.ingest.us.sentry.io/4509483637932032",

  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  
  // Set profilesSampleRate to 1.0 to profile every transaction.
  // Since profilesSampleRate is relative to tracesSampleRate,
  // the final profiling rate can be computed as tracesSampleRate * profilesSampleRate
  // For example, a tracesSampleRate of 0.5 and profilesSampleRate of 0.5 would
  // result in 25% of transactions being profiled (0.5*0.5=0.25)
  profilesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // Environment configuration
  environment: process.env.NODE_ENV || 'production',
  
  // Release tracking
  release: process.env.npm_package_version || '0.0.1',

  // Debug mode only when explicitly enabled to avoid console spam
  debug: process.env.SENTRY_DEBUG === '1',

  // Enhanced error filtering
  beforeSend(event) {
    // Filter out health check requests
    if (event.request?.url?.includes('/api/health')) {
      return null;
    }

    // Filter out monitoring bots
    if (event.request?.headers?.['user-agent']?.includes('AlwaysOn')) {
      return null;
    }

    // Filter out network errors
    if (event.exception?.values?.[0]?.value?.includes('ENOTFOUND')) {
      return null;
    }

    return event;
  },

  // Initial scope configuration
  initialScope: {
    tags: {
      component: 'pixelated-node-server',
      platform: 'node',
      framework: 'astro',
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
});
