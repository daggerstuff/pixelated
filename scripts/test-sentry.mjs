#!/usr/bin/env node

import { captureError, closeSentry } from '../instrument.mjs'

async function main() {
  try {
    // Only throw the test exception when explicitly intended.
    // Prevents accidental execution in production environments.
    const shouldThrowTestException = process.env.FORCE_TEST_SENTRY === '1' || process.env.NODE_ENV !== 'production'
    if (shouldThrowTestException) {
      // Only print non-sensitive info when testing is intended
      console.log('SENTRY_DEBUG:', process.env.SENTRY_DEBUG)
      throw new Error('Test Sentry exception from scripts/test-sentry.mjs')
    } else {
      // Do not print DSN or debug info in production skip mode
      console.log('Skipping test Sentry throw because NODE_ENV=production and FORCE_TEST_SENTRY is not set.')
    }
  } catch (err) {
    console.log('Captured locally, sending to Sentry (if configured)')
    captureError(err)
    // Give Sentry a moment to flush and then close gracefully
    await new Promise((r) => setTimeout(r, 2000))
    try {
      await closeSentry()
    } catch (closeErr) {
      console.error('Error closing Sentry:', closeErr)
    }
    console.log('Done. Check Sentry dashboard for a new event if DSN is configured.')
  }
}

main().catch((e) => {
  console.error('Test script failed:', e)
  process.exit(1)
})
