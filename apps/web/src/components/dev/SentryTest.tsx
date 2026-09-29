/**
 * Sentry Test Component
 *
 * A simple component for testing Sentry integration in development.
 * This component provides buttons to test error reporting and should
 * only be used in development environments.
 */

import {
  testSentryIntegration,
  captureError,
  captureMessage,
} from '../../lib/sentry/utils'

interface SentryTestProps {
  className?: string
}

export default function SentryTest({ className = '' }: SentryTestProps) {
  // Only show in development
  if (import.meta.env.PROD) {
    return null
  }

  const handleTestError = () => {
    try {
      throw new Error('Test error from Sentry Test component')
    } catch (error: unknown) {
      captureError(error as Error, {
        testComponent: {
          action: 'manual_test_error',
          timestamp: new Date().toISOString(),
        },
      })
    }
  }

  const handleTestMessage = () => {
    captureMessage('Test message from Sentry Test component', 'info', {
      testComponent: {
        action: 'manual_test_message',
        timestamp: new Date().toISOString(),
      },
    })
  }

  const handleFullTest = () => {
    testSentryIntegration()
  }

  return (
    <div className={`sentry-test-component ${className}`}>
      <div className="rounded-none border border-ring bg-secondary p-4">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          🧪 Sentry Integration Test (Development Only)
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleTestError}
            className="rounded-none border border-border bg-secondary px-3 py-1 text-xs text-foreground hover:bg-accent"
          >
            Test Error
          </button>
          <button
            onClick={handleTestMessage}
            className="rounded-none border border-border bg-secondary px-3 py-1 text-xs text-foreground hover:bg-accent"
          >
            Test Message
          </button>
          <button
            onClick={handleFullTest}
            className="rounded-none border border-border bg-secondary px-3 py-1 text-xs text-foreground hover:bg-accent"
          >
            Full Test
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Check your Sentry dashboard at{' '}
          <a
            href="https://pixelated-empathy-dq.sentry.io/projects/pixel-astro/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Sentry Dashboard
          </a>
        </p>
      </div>
    </div>
  )
}
