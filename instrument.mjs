// instrument.mjs — Comprehensive Sentry Node.js instrumentation for production builds

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { httpIntegration } from '@sentry/node';

// Enhanced Sentry configuration with comprehensive instrumentation
Sentry.init({
  dsn: process.env.SENTRY_DSN, // Must be set in environment
  environment: process.env.NODE_ENV || 'production',
  release: process.env.SENTRY_RELEASE || process.env['npm_package_version'],

  // Performance monitoring configuration
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE) || 0.1,

  // Integrations for comprehensive monitoring
  integrations: [
    // HTTP integration for outgoing requests
    httpIntegration({ tracing: true }),

    // Profiling integration for performance monitoring
    nodeProfilingIntegration(),
  ],

  // Tracing configuration
  tracePropagationTargets: [
    // Add your frontend domains here for distributed tracing
    /^https:\/\/.*\.pixelatedempathy\.tech/,
    /^https:\/\/.*\.pixelatedempathy\.com/,
    'localhost',
    /^\//,
  ],

  // Before send hook for filtering sensitive data
  beforeSend: (event, hint) => {
    // Filter out sensitive data from events
    if (event.request?.data) {
      // Remove sensitive fields from request data
      const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];
      sensitiveFields.forEach(field => {
        if (event.request.data[field]) {
          event.request.data[field] = '[FILTERED]';
        }
      });
    }
    return event;
  },

  // Before breadcrumb hook for custom breadcrumb handling
  beforeBreadcrumb: (breadcrumb) => {
    // Customize breadcrumbs as needed
    if (breadcrumb.category === 'console') {
      // Enhance console breadcrumbs with more context
      breadcrumb.level = breadcrumb.level || 'info';
    }
    return breadcrumb;
  },

  // Initial scope configuration
  initialScope: {
    tags: {
      service: 'pixelated-backend',
      version: process.env['npm_package_version'],
      node_version: process.version,
    },
  },
});

// Performance monitoring helpers
export const startTransaction = (name, operation = 'function') => {
  return Sentry.startInactiveSpan({ name, op: operation });
};

export const startSpan = (name, operation = 'function') => {
  return Sentry.startSpan({ name, op: operation });
};

// Error handling helpers
export const captureError = (error, context = {}) => {
  Sentry.withScope((scope) => {
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    if (context.user) {
      scope.setUser(context.user);
    }
    Sentry.captureException(error);
  });
};

// User context helper
export const setUserContext = (user) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
    // Add any other relevant user fields
  });
};

// Custom metrics and monitoring
export const recordMetric = (name, value, tags = {}) => {
  Sentry.metrics.increment(name, value, { tags });
};

// Health check function for monitoring
export const healthCheck = () => {
  const transaction = Sentry.startSpan({ name: 'health-check', op: 'function' });
  try {
    // Add your health check logic here
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    Sentry.captureException(error);
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  } finally {
    transaction?.end();
  }
};

// Graceful shutdown handler
export const closeSentry = async () => {
  await Sentry.close();
};

// Middleware for Express.js applications
export const sentryMiddleware = (req, res, next) => {
  const transaction = Sentry.startSpan({
    name: `${req.method} ${req.path}`,
    op: 'http.server',
  });

  // Set user context if available
  if (req.user) {
    Sentry.setUser({
      id: req.user.id,
      email: req.user.email,
    });
  }

  // Add request context
  Sentry.setContext('request', {
    method: req.method,
    url: req.url,
    headers: {
      'user-agent': req.get('User-Agent'),
      'content-type': req.get('Content-Type'),
    },
  });

  res.on('finish', () => {
    transaction?.end();
  });

  next();
};

// Database instrumentation helper
export const instrumentDatabaseQuery = async (query, operation = 'db.query') => {
  const span = Sentry.startSpan({ name: query, op: operation });
  try {
    // Your database query logic here
    return await query;
  } catch (error) {
    Sentry.captureException(error);
    throw error;
  } finally {
    span?.end();
  }
};

// Export Sentry for direct access if needed
export { Sentry };

// Export additional utilities
export default {
  Sentry,
  startTransaction,
  startSpan,
  captureError,
  setUserContext,
  recordMetric,
  healthCheck,
  closeSentry,
  sentryMiddleware,
  instrumentDatabaseQuery,
};

// This file is intended for import at the very top of your backend entry point.
// If Sentry is not wanted, set SENTRY_DSN="" in config or remove import.
