import { defineHook } from 'eve/hooks'

// PII redaction pass on every assistant reply. Will route through
// ai-services/security/pii_scrubber.py once the sidecar is wired. For now
// only logs the call; the real scrub is performed when the parent's
// save_session tool runs and that stub includes the same call site.

export default defineHook({
  events: {
    'content.completed'(event) {
      const data = (
        event as { data?: { kind?: unknown; phase?: unknown; value?: unknown } }
      ).data
      if (data?.kind !== 'text' || data?.phase !== 'reply') return
      const text = typeof data.value === 'string' ? data.value : ''
      if (typeof text === 'string') {
        // error handled by caller
      }
    },
  },
})
