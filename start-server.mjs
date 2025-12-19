#!/usr/bin/env node

import { Sentry, closeSentry } from './instrument.mjs'

import { createServer } from 'node:http'
import { handler as ssrHandler } from '/app/dist/server/entry.mjs'

const rawPort = process.env.PORT ?? process.env.WEBSITES_PORT;
const parsedPort = rawPort !== undefined ? Number(rawPort) : NaN;
let initialPort = Number.isFinite(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 4321;
if (
  Number.isNaN(initialPort) ||
  initialPort < 0 ||
  initialPort > 65535
) {
  console.error(`Invalid port: ${initialPort}. Falling back to default port 4321.`)
  initialPort = 4321
}
const host = process.env.HOST || '0.0.0.0'

const isPortFallbackDisabled =
  !!process.env.WEBSITES_PORT ||
  !!process.env.NO_PORT_FALLBACK ||
  !!process.env.FORCE_EXIT_ON_EADDRINUSE

// Note: We create the server inside tryListen() to avoid port conflicts
// The unused 'server' object was removed to prevent double-binding issues
let activeRetryServer = null

function redactValue(val, keepLast = 8) {
  if (!val) {
    return '<missing>'
  }
  try {
    const s = String(val)
    if (s.length <= keepLast + 4) {
      return 'REDACTED'
    }
    return `${s.slice(0, 4)}...${s.slice(-keepLast)}`
  } catch (e) {
    console.error('Error in redactValue:', e)
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

// Error handling is now done within tryListen() for the retryServer
// Removed unused server.on('error') handler that was causing conflicts

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  try {
    if (activeRetryServer) {
      activeRetryServer.removeAllListeners('error')
      activeRetryServer.close(() => {
        console.log('Process terminated')
        process.exit(0)
      })
    } else {
      process.exit(0)
    }
  } catch {
    process.exit(0)
  }
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  try {
    if (activeRetryServer) {
      activeRetryServer.removeAllListeners('error')
      activeRetryServer.close(() => {
        console.log('Process terminated')
        process.exit(0)
      })
    } else {
      process.exit(0)
    }
  } catch {
    process.exit(0)
  }
})

const baseDelay = 250
const maxDelay = 5000

function tryListen(portToTry, retriesLeft, delay = baseDelay) {
  let port = Number(portToTry)
  if (
    Number.isNaN(port) ||
    port < 0 ||
    port > 65535
  ) {
    console.error(`Invalid port: ${portToTry}. Falling back to default port 4321.`)
    port = 4321
  }

  // If there's an existing retry server, close and detach it so it can be
  // garbage collected before creating a new one.
  if (activeRetryServer) {
    try {
      // Only clear 'error' listeners to avoid touching other process-wide
      // handlers that may be registered elsewhere.
      activeRetryServer.removeAllListeners('error')
      activeRetryServer.close(() => { })
    } catch {
      // ignore
    }
    activeRetryServer = null
  }

  // Create a fresh server for this listen attempt. We keep a reference in
  // activeRetryServer so we can clean it up on the next retry.
  const retryServer = createServer(ssrHandler)
  activeRetryServer = retryServer

  const onListening = () => {
    retryServer.off('error', onError);
    console.log(`Server running at http://${host}:${port}`)
    try {
      logSentryStartupChecks()
    } catch (e) {
      console.error('Failed to run Sentry startup checks:', e)
    }
  }

  const onError = (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use.`)

      if (isPortFallbackDisabled) {
        console.error('Port fallback disabled by environment (WEBSITES_PORT or NO_PORT_FALLBACK or FORCE_EXIT_ON_EADDRINUSE). Exiting.')
        // Only report to Sentry when port fallback is disabled (fatal error)
        try {
          if (Sentry) {
            Sentry.captureException(err, {
              tags: {
                fatal: true,
                port_fallback_disabled: true,
              },
            })
          }
        } catch (e) {
          console.error('Failed to capture EADDRINUSE to Sentry:', e)
        }
        closeSentry().finally(() => process.exit(1))
        return
      }

      if (retriesLeft <= 0) {
        console.error('No retries left for port fallback. Exiting.')
        // Only report to Sentry when retries are exhausted (fatal error)
        try {
          if (Sentry) {
            Sentry.captureException(err, {
              tags: {
                fatal: true,
                retries_exhausted: true,
              },
            })
          }
        } catch (e) {
          console.error('Failed to capture EADDRINUSE to Sentry:', e)
        }
        closeSentry().finally(() => process.exit(1))
        return
      }

      // Port fallback is enabled and retries are available - don't report to Sentry
      // This is expected behavior and will be handled gracefully
      const nextPort = port + 1
      const nextDelay = Math.min(delay * 2, maxDelay)
      console.warn(`Attempting fallback to port ${nextPort} (${retriesLeft - 1} retries left, delay ${delay}ms)`)
      setTimeout(() => tryListen(nextPort, retriesLeft - 1, nextDelay), delay)
      return
    }

    console.error('Listen error:', err)
    // Report non-EADDRINUSE errors to Sentry as they are unexpected
    try {
      if (Sentry) {
        Sentry.captureException(err)
      }
    } catch (e) {
      console.error('Failed to capture listen error to Sentry:', e)
    }
  }

  retryServer.once('error', onError)
  retryServer.listen(port, host, onListening)
}

const retriesRaw = process.env.PORT_FALLBACK_MAX_RETRIES;
let maxRetries;
{
  const n = retriesRaw !== undefined ? Number.parseInt(String(retriesRaw), 10) : NaN;
  maxRetries = Number.isFinite(n) && n >= 0 ? n : 10;
}
tryListen(initialPort, maxRetries)

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  try {
    if (Sentry) {
      Sentry.captureException(reason instanceof Error ? reason : new Error(String(reason)))
    }
  } catch (e) {
    console.error('Failed to capture unhandledRejection to Sentry:', e)
  }
  closeSentry().finally(() => process.exit(1))
})

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err)
  try {
    if (Sentry) {
      Sentry.captureException(err)
    }
  } catch (e) {
    console.error('Failed to capture uncaughtException to Sentry:', e)
  }
  closeSentry().finally(() => process.exit(1))
})
