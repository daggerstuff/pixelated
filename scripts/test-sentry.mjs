#!/usr/bin/env node

import '../instrument.mjs'

import { captureError } from '../instrument.mjs'

console.log('SENTRY_DSN:', process.env.SENTRY_DSN)
console.log('SENTRY_DEBUG:', process.env.SENTRY_DEBUG)

async function main() {
  try {
    // Only throw the test exception when explicitly allowed.
    // Prevents accidental execution in production environments.
    const allowTest = process.env.FORCE_TEST_SENTRY === '1' || process.env.NODE_ENV !== 'production'
    if (allowTest) {
      throw new Error('Test Sentry exception from scripts/test-sentry.mjs')
    } else {
      console.log('Skipping test Sentry throw because NODE_ENV=production and FORCE_TEST_SENTRY is not set.')
    }
  } catch (err) {
    console.log('Captured locally, sending to Sentry (if configured)')
    captureError(err)
    // Give Sentry a moment to flush and then close gracefully
    await new Promise((r) => setTimeout(r, 2000))
    try {
      await (await import('../instrument.mjs')).closeSentry()
    } catch (_e) {
      // ignore
    }
    console.log('Done. Check Sentry dashboard for a new event if DSN is configured.')
  }
}

main().catch((e) => {
  console.error('Test script failed:', e)
  process.exit(1)
})
