import { defineSchedule } from "eve/schedules";

// Weekly training trigger. Fires every Monday at 09:00 UTC. The
// orchestrator preflights the pipeline infra and initiates a curation
// run.

export default defineSchedule({
  cron: "0 9 * * 1",
  markdown:
    "Initiate the weekly training pipeline: run infrastructure health " +
    "check, then kick off dataset curation.",
});
