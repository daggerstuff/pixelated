import { defineSchedule } from 'eve/schedules'

// Hourly intake sweep. Fires at the top of each hour to process any
// queued intake requests and route them to the appropriate downstream agent.

export default defineSchedule({
  cron: '0 * * * *',
  markdown:
    'Hourly intake sweep: process queued intake requests, triage by ' +
    'priority, and route to downstream agents (session, content, qa).',
})
