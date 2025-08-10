// The Sentry DSN should be injected during build or passed as a global variable
// Check for the DSN in different possible locations
const SENTRY_DSN =
  window.SENTRY_DSN || (window.__ENV && window.__ENV.PUBLIC_SENTRY_DSN) || null // Fallback to null if not found

if (SENTRY_DSN && window.Sentry) {
  try {
    window.Sentry.init({
      dsn: SENTRY_DSN,
      tracesSampleRate: Number(
        (window.__ENV && window.__ENV.PUBLIC_SENTRY_TRACES_SAMPLE_RATE) ?? (location.hostname === 'localhost' ? 1.0 : 0.1)
      ),
      profilesSampleRate: Number(
        (window.__ENV && window.__ENV.PUBLIC_SENTRY_PROFILES_SAMPLE_RATE) ?? (location.hostname === 'localhost' ? 0.2 : 0.05)
      ),
      debug: Boolean(window.__ENV && window.__ENV.PUBLIC_SENTRY_DEBUG === '1'),
    })
    console.log('Sentry initialized successfully')
  } catch (err) {
    console.warn('Failed to initialize Sentry:', err)
  }
}
else if (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1') {
    console.warn('Sentry not initialized: missing DSN or Sentry library')
  }
