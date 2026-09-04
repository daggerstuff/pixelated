import { defineHook } from 'eve/hooks'

// Audit log for session lifecycle, tool call results, and message completions.
// Emits structured console records for log aggregation / Foresight reconstruction.

export default defineHook({
  events: {
    'session.started'(_event, ctx) {
      // error handled by caller
    },
    'action.result'(event, _ctx) {
      const eventData = (event as { data?: unknown }).data
      const status =
        typeof eventData === 'object' &&
        eventData !== null &&
        'status' in eventData
          ? (eventData as { status?: unknown }).status
          : eventData
    },
    'message.completed'(event, _ctx) {
      const text = event.data?.message ?? ''
    },
  },
})
