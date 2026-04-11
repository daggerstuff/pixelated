/// <reference types="astro/client" />
import * as LaunchDarkly from 'launchdarkly-js-client-sdk'

let ldClient: LaunchDarkly.LDClient | null = null

if (typeof window !== 'undefined') {
  // Initialize LaunchDarkly for feature flagging; use env/config abstraction in real code
  ldClient = LaunchDarkly.initialize(
    (import.meta.env['PUBLIC_LD_CLIENT_ID'] as string) ?? '', // Place real key in environment abstraction
    { kind: 'user', key: (import.meta.env['PUBLIC_LD_USER_KEY'] as string) ?? '' },
  )

  // Demo: Evaluate a flag after client is ready
  ldClient.on('ready', () => {
    // Simple one-shot test, opt-in during development
    /* Uncomment to test
    const flagValue = ldClient.variation('test-flag', false)
    console.log('LaunchDarkly flag value:', flagValue)
    */
  })
}

export default function LaunchDarklyInit() {
  return null // runs once on the client to bootstrap LaunchDarkly
}
