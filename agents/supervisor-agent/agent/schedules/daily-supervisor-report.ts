import { defineSchedule } from 'eve/schedules'

// Daily supervisor report. Fires at 07:00 UTC to aggregate agent
// performance metrics and surface any unresolved issues from the prior day.

export default defineSchedule({
  cron: '0 7 * * *',
  markdown:
    'Daily supervisor report: aggregate agent metrics from the prior 24h, ' +
    'flag unresolved issues, and post a summary digest for review.',
})
