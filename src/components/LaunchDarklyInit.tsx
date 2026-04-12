/// <reference types="astro/client" />
import * as LaunchDarkly from 'launchdarkly-js-client-sdk'

let ldClient: LaunchDarkly.LDClient | null = null
const clientId =
  typeof import.meta.env.PUBLIC_LD_CLIENT_ID === 'string'
    ? import.meta.env.PUBLIC_LD_CLIENT_ID
    : undefined
const userKey =
  typeof import.meta.env.PUBLIC_LD_USER_KEY === 'string'
    ? import.meta.env.PUBLIC_LD_USER_KEY
    : undefined

if (!import.meta.env.SSR && !ldClient) {
  // Initialize LaunchDarkly for feature flagging; use env/config abstraction in real code
  if (typeof clientId === 'string' && typeof userKey === 'string') {
    ldClient = LaunchDarkly.initialize(clientId, { kind: 'user', key: userKey })

    // Demo: Evaluate a flag after client is ready
    ldClient.on('ready', () => {
      // Simple one-shot test, opt-in during development
      /* Uncomment to test
      const flagValue = ldClient.variation('test-flag', false)
      console.log('LaunchDarkly flag value:', flagValue)
      */
    })
  }
}

export default function LaunchDarklyInit() {
  return null // runs once on the client to bootstrap LaunchDarkly
}
