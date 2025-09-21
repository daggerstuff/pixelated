#!/usr/bin/env node

import '../instrument.mjs'

import { captureError } from '../instrument.mjs'

console.log('SENTRY_DSN:', process.env.SENTRY_DSN)
console.log('SENTRY_DEBUG:', process.env.SENTRY_DEBUG)

async function main() {
  try {
    throw new Error('Test Sentry exception from scripts/test-sentry.mjs')
  } catch (err) {
    console.log('Captured locally, sending to Sentry (if configured)')
    captureError(err)
    // Give Sentry a moment to flush and then close gracefully
    await new Promise((r) => setTimeout(r, 2000))
    try {
      await (await import('../instrument.mjs')).closeSentry()
    } catch (e) {
      // ignore
    }
    console.log('Done. Check Sentry dashboard for a new event if DSN is configured.')
  }
}

main().catch((e) => {
  console.error('Test script failed:', e)
  process.exit(1)
})
