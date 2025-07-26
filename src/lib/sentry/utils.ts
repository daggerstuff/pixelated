/**
 * Sentry Utilities for Manual Error Reporting
 *
 * This file provides utilities for manually capturing errors,
 * messages, and performance data in the Pixelated Empathy application.
 */

import * as Sentry from '@sentry/astro'

/**
 * Manually capture an error with additional context
 */
export function captureError(error: Error, context?: Record<string, unknown>) {
  return Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value as Record<string, unknown>)
      })
    }

    scope.setTag('source', 'manual')
    scope.setLevel('error')

    return Sentry.captureException(error)
  })
}

/**
 * Manually capture a message with additional context
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>,
) {
  return Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value as Record<string, unknown>)
      })
    }

    scope.setTag('source', 'manual')
    scope.setLevel(level)

    return Sentry.captureMessage(message)
  })
}

/**
 * Set user context for Sentry
 */
export function setUserContext(user: {
  id?: string
  email?: string
  username?: string
  [key: string]: unknown
}) {
  Sentry.setUser(user)
}

/**
 * Add breadcrumb for user action tracking
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
) {
  Sentry.addBreadcrumb({
    message,
    category,
    ...(data ? { data } : {}),
    timestamp: Date.now() / 1000,
    level: 'info',
  })
}

/**
 * Start a performance transaction
 *
 * @deprecated Sentry Astro does not support manual transactions. This is a no-op.
 */
export function startTransaction(_name: string, _operation: string) {
  // Sentry Astro does not support manual transactions.
  // This function is a no-op for compatibility.
  if (import.meta.env.DEV) {
    console.warn(
      '[Sentry] startTransaction is not supported in @sentry/astro and will be ignored.',
    )
  }
  return {
    setData: () => {},
    finish: () => {},
  }
}

/**
 * Test Sentry integration
 */
export function testSentryIntegration() {
  // Create a test error
  const testError = new Error('Sentry integration test - this is expected')

  // Capture with context
  captureError(testError, {
    test: {
      timestamp: new Date().toISOString(),
      purpose: 'Integration test',
      environment: import.meta.env.MODE,
    },
  })

  // Capture a test message
  captureMessage('Sentry integration test message', 'info', {
    test: {
      type: 'message',
      timestamp: new Date().toISOString(),
    },
  })
}

/**
 * Performance monitoring utilities
 *
 * @deprecated Sentry Astro does not support manual performance transactions.
 * These methods are no-ops and kept for compatibility.
 */
export const performance = {
  /**
   * Measure page load performance (no-op)
   */
  measurePageLoad: (_pageName: string) => {
    if (import.meta.env.DEV) {
      console.warn(
        '[Sentry] measurePageLoad is not supported in @sentry/astro and will be ignored.',
      )
    }
    return {
      setData: () => {},
      finish: () => {},
    }
  },

  /**
   * Measure API call performance (no-op)
   */
  measureApiCall: (_endpoint: string, _method: string = 'GET') => {
    if (import.meta.env.DEV) {
      console.warn(
        '[Sentry] measureApiCall is not supported in @sentry/astro and will be ignored.',
      )
    }
    return {
      setData: () => {},
      finish: () => {},
    }
  },
}

// Export commonly used Sentry functions for convenience
export const {
  captureException,
  captureMessage: sentryCaptureMessage,
  withScope,
} = Sentry

// Re-export the main Sentry object
export { Sentry }
