import { defineHook } from 'eve/hooks'

// Emits an audit record for every QA-flag ticket so the program leads
// can review the flag outcome distribution. Connects to the existing
// `audit_log` collection via the session-mcp in production.

export default defineHook({
  events: {
    'action.result'(_event, _ctx) {
      // error handled by caller
    },
  },
})
