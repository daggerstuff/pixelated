import { defineSchedule } from 'eve/schedules'

// Daily agent health check. Fires at 08:00 UTC to verify all downstream
// agents are responsive and their schedules are firing as expected.

export default defineSchedule({
  cron: '0 8 * * *',
  markdown:
    'Daily health check: verify all downstream agents (intake, content, ' +
    'session, qa, pipeline, advisor, supervisor) are responsive, check ' +
    'schedule fire history, and report anomalies.',
})
