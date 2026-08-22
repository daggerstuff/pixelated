import { defineSchedule } from 'eve/schedules'

// Daily content freshness check. Fires at 06:00 UTC (early morning PT)
// to review and refresh stale clinical content references.

export default defineSchedule({
  cron: '0 6 * * *',
  markdown:
    'Daily content freshness review: scan clinical content for outdated ' +
    'references, flag stale guidelines, and queue updates for review.',
})
