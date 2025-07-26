// Set Sentry DSN as a global variable for the initialization script
// This script expects the PUBLIC_SENTRY_DSN to be set as a global variable by the server
;(function () {
  // Try to get DSN from various sources
  var sentryDsn = window.PUBLIC_SENTRY_DSN || ''

  // Set up globals for sentry-init.js
  window.SENTRY_DSN = sentryDsn || null
  window.__ENV = window.__ENV || {}
  window.__ENV.PUBLIC_SENTRY_DSN = sentryDsn || null
})()
