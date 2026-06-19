import { defineSchedule } from "eve/schedules";

// Daily batch review. Fires at the trailing edge of each working day
// in UTC (23:30 UTC ~= 16:30 PT / 19:30 ET — outside EU working hours;
// tune via the deployer's `CRON_TZ` when not on Vercel).

export default defineSchedule({
  cron: "30 23 * * *",
  markdown: "Daily QA review: fetch closed sessions since last cursor, score, and post digest.",
});

