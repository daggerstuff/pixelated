import { defineHook } from 'eve/hooks'

// Audit log for session lifecycle, tool call results, and message completions.
// Emits structured console records for log aggregation / Foresight reconstruction.

export default defineHook({
  events: {
    'session.started'(_event, ctx) {
      // error handled by caller
    },
    'call.settled'(event, _ctx) {
      const eventData = (event as { data?: unknown }).data
      const status =
        typeof eventData === 'object' &&
        eventData !== null &&
        'outcome' in eventData
          ? (eventData as { outcome?: unknown }).outcome
          : eventData
    },
    'content.completed'(event, _ctx) {
      const data = (event as { data?: { value?: unknown } }).data
      const text = typeof data?.value === 'string' ? data.value : ''
    },
  },
})
