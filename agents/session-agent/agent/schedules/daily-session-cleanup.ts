import { defineSchedule } from 'eve/schedules'

// Daily session cleanup. Fires at 22:00 UTC to archive stale sessions
// and compact long-running session state to keep memory bounded.

export default defineSchedule({
  cron: '0 22 * * *',
  markdown:
    'Daily session cleanup: archive sessions inactive for >24h, compact ' +
    'long-running session state, and verify PII scrub coverage.',
})
