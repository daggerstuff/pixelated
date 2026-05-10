import * as Sentry from '@sentry/react'

/**
 * Sentry Test Component
 * Use this to verify Sentry is properly configured.
 * Access at: /test-sentry in development
 */
export function SentryTest() {
  const handleTestError = () => {
    throw new Error('Sentry test error - triggered from button click')
  }

  const handleTestMessage = () => {
    Sentry.captureMessage('Sentry test message', 'info')
    alert('Test message sent to Sentry! Check the dashboard.')
  }

  const handleTestException = () => {
    // This will be caught by React error boundary
    const error = new Error('Sentry test exception')
    Sentry.captureException(error)
    alert('Exception captured! Check Sentry Issues.')
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Sentry Configuration Test</h1>
      <p>
        Use these buttons to verify Sentry is properly configured and sending
        events.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <button
          onClick={handleTestError}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Test Error (throws)
        </button>

        <button
          onClick={handleTestException}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Test Exception (captureException)
        </button>

        <button
          onClick={handleTestMessage}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Test Message (captureMessage)
        </button>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '0.5rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>What to check:</h3>
        <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem' }}>
          <li>Open browser DevTools Console for SDK debug logs</li>
          <li>Check Sentry Dashboard → Issues for new events</li>
          <li>Verify source maps are working (stack traces should show original code)</li>
          <li>Check Traces tab for transaction tracking</li>
        </ul>
      </div>
    </div>
  )
}
