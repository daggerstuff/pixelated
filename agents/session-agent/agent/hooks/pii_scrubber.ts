import { defineHook } from 'eve/hooks'

import { createBuildSafeLogger } from '../../../../src/lib/logging/build-safe-logger'

// PII redaction pass on every assistant reply. Will route through
// ai-services/security/pii_scrubber.py once the sidecar is wired. For now
// only logs the call; the real scrub is performed when the parent's
// save_session tool runs and that stub includes the same call site.

const logger = createBuildSafeLogger('pii-scrubber')

export default defineHook({
  events: {
    'message.completed'(event) {
      const text = event.data?.message ?? ''
      if (typeof text === 'string') {
        logger.info('pii-scrubber would scan', { chars: text.length })
      }
    },
  },
})
