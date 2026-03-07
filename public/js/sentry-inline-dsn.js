// Set the DSN as a global variable that can be accessed by external scripts
;(function () {
  // Try to get DSN from the data attribute
  const sentryDsnElement = document.getElementById('sentry-dsn-script')
  const sentryDsn = sentryDsnElement
    ? sentryDsnElement.getAttribute('data-dsn')
    : null

  window.PUBLIC_SENTRY_DSN = sentryDsn || null
})()
