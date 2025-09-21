#!/usr/bin/env node

// Import Astro's production server
// Ensure Sentry instrumentation runs for server-side errors. This import
// initializes Sentry if `process.env.SENTRY_DSN` is set. Keep it near the
// top so instrumentation is active before the SSR handler starts.
import { Sentry, closeSentry } from './instrument.mjs'

import { createServer } from 'node:http'
import { handler as ssrHandler } from './dist/server/entry.mjs'

const port = process.env.PORT || process.env.WEBSITES_PORT || 4321
const host = process.env.HOST || '0.0.0.0'

// Create HTTP server with Astro SSR handler
const server = createServer(ssrHandler)

// Startup environment validation (safe — redacts secrets)
function redactValue(val, keepLast = 8) {
  if (!val) return '<missing>'
  try {
    const s = String(val)
    if (s.length <= keepLast + 4) return 'REDACTED'
    return `${s.slice(0, 4)}...${s.slice(-keepLast)}`
  } catch (e) {
    return '<invalid>'
  }
}

function logSentryStartupChecks() {
  const serverDsn = process.env.SENTRY_DSN
  const publicDsn = process.env.PUBLIC_SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN
  const release = process.env.SENTRY_RELEASE
  const authToken = process.env.SENTRY_AUTH_TOKEN

  console.log('Sentry startup check:')
  console.log('  SENTRY_DSN:', serverDsn ? redactValue(serverDsn) : '<missing>')
  console.log('  PUBLIC_SENTRY_DSN:', publicDsn ? redactValue(publicDsn) : '<missing>')
  console.log('  SENTRY_RELEASE:', typeof release === 'string' && release.length ? release : '<missing>')
  console.log('  SENTRY_AUTH_TOKEN provided:', !!authToken)
  if (!serverDsn) {
    console.warn('Warning: SENTRY_DSN is not set — server-side events will not be sent to Sentry.')
  }
  if (!release) {
    console.warn('Warning: SENTRY_RELEASE is not set — sessions or releases may be rejected by Sentry.')
  }
}

// Error handling
server.on('error', (err) => {
  console.error('Server error:', err)
  try {
    if (Sentry) Sentry.captureException(err)
  } catch (e) {
    console.error('Failed to capture exception to Sentry:', e)
  }
  // Flush Sentry and exit
  closeSentry().finally(() => process.exit(1))
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  server.close(() => {
    console.log('Process terminated')
    process.exit(0)
  })
})

// Start server
server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`)
  // Log lightweight startup checks for Sentry and related envs
  try {
    logSentryStartupChecks()
  } catch (e) {
    console.error('Failed to run Sentry startup checks:', e)
  }
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  try {
    if (Sentry) Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)))
  } catch (e) {
    console.error('Failed to capture unhandledRejection to Sentry:', e)
  }
  closeSentry().finally(() => process.exit(1))
})

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
  try {
    if (Sentry) Sentry.captureException(err)
  } catch (e) {
    console.error('Failed to capture uncaughtException to Sentry:', e)
  }
  closeSentry().finally(() => process.exit(1))
})
