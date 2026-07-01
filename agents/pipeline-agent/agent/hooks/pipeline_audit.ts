import { defineHook } from 'eve/hooks'

import { createBuildSafeLogger } from '../../../../src/lib/logging/build-safe-logger'

// Audit log for every pipeline state transition and tool call result.
// The hook emits a structured event record so the program leads can
// reconstruct the full run trace from Foresight or a log aggregator.

const logger = createBuildSafeLogger('pipeline-audit')

export default defineHook({
  events: {
    'action.result'(event, _ctx) {
      const eventData = (event as { data?: unknown }).data
      const status =
        typeof eventData === 'object' &&
        eventData !== null &&
        'status' in eventData
          ? (eventData as { status?: unknown }).status
          : eventData
      logger.info('action result', { status })
    },
    'message.completed'(event, _ctx) {
      const eventType = (event as { type?: unknown }).type
      logger.info('message completed', {
        type: typeof eventType === 'string' ? eventType : eventType,
      })
    },
  },
})
