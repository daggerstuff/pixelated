// The Sentry DSN should be injected during build or passed as a global variable
// Check for the DSN in different possible locations
const SENTRY_DSN =
  window.SENTRY_DSN || (window.__ENV && window.__ENV.PUBLIC_SENTRY_DSN) || null // Fallback to null if not found

if (SENTRY_DSN && window.Sentry) {
  try {
    window.Sentry.init({
      dsn: SENTRY_DSN,
      // Add any other Sentry options here
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
