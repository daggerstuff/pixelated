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
      console.log('✅ Test error sent to Sentry!')
    }
  }

  const handleTestMessage = () => {
    captureMessage('Test message from Sentry Test component', 'info', {
      testComponent: {
        action: 'manual_test_message',
        timestamp: new Date().toISOString(),
      },
    })
    console.log('✅ Test message sent to Sentry!')
  }

  const handleFullTest = () => {
    testSentryIntegration()
  }

  return (
    <div className={`sentry-test-component ${className}`}>
      <div className='bg-yellow-100 border-yellow-400 rounded-lg border p-4'>
        <h3 className='text-yellow-800 mb-2 text-sm font-semibold'>
          🧪 Sentry Integration Test (Development Only)
        </h3>
        <div className='flex flex-wrap gap-2'>
          <button
            onClick={handleTestError}
            className='bg-red-500 text-white hover:bg-red-600 rounded px-3 py-1 text-xs'
          >
            Test Error
          </button>
          <button
            onClick={handleTestMessage}
            className='bg-blue-500 text-white hover:bg-blue-600 rounded px-3 py-1 text-xs'
          >
            Test Message
          </button>
          <button
            onClick={handleFullTest}
            className='bg-green-500 text-white hover:bg-green-600 rounded px-3 py-1 text-xs'
          >
            Full Test
          </button>
        </div>
        <p className='text-yellow-700 mt-2 text-xs'>
          Check your Sentry dashboard at{' '}
          <a
            href='https://pixelated-empathy-dq.sentry.io/projects/pixel-astro/'
            target='_blank'
            rel='noopener noreferrer'
            className='underline'
          >
            Sentry Dashboard
          </a>
        </p>
      </div>
    </div>
  )
}
