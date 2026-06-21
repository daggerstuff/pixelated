import { defineHook } from 'eve/hooks'

// Emits an audit record for every QA-flag ticket so the program leads
// can review the flag outcome distribution. Connects to the existing
// `audit_log` collection via the session-mcp in production.

export default defineHook({
  events: {
    'action.result'(_event, _ctx) {
      // TODO(disable-no-console): replace with structured logger;
      // this stub will become a connection__session_mcp__append_event
      // call once the sidecar is wired.
      // eslint-disable-next-line no-console
      console.info('[qa-audit] action finished')
    },
  },
})
