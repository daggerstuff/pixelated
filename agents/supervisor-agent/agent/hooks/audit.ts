import { defineHook } from 'eve/hooks'

// Audit log for session lifecycle, tool call results, and message completions.
// Emits structured console records for log aggregation / Foresight reconstruction.

export default defineHook({
  events: {
    'session.started'(_event, ctx) {
      console.log('[supervisor-audit] session started', {
        agent: ctx.agent.name,
      })
    },
    'action.result'(event, _ctx) {
      const eventData = (event as { data?: unknown }).data
      const status =
        typeof eventData === 'object' &&
        eventData !== null &&
        'status' in eventData
          ? (eventData as { status?: unknown }).status
          : eventData
      console.log('[supervisor-audit] action result', { status })
    },
    'message.completed'(event, _ctx) {
      const text = event.data?.message ?? ''
      console.log('[supervisor-audit] message completed', {
        chars: typeof text === 'string' ? text.length : 0,
      })
    },
  },
})
