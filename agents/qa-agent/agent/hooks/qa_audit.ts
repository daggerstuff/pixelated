import { defineHook } from 'eve/hooks'

import { createBuildSafeLogger } from '../../../../src/lib/logging/build-safe-logger'

// Emits an audit record for every QA-flag ticket so the program leads
// can review the flag outcome distribution. Connects to the existing
// `audit_log` collection via the session-mcp in production.

const logger = createBuildSafeLogger('qa-audit')

export default defineHook({
  events: {
    'action.result'(_event, _ctx) {
      logger.info('action finished')
    },
  },
})
