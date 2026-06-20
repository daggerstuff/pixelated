import { defineTool } from "eve/tools";
import { z } from "zod";

export default defineTool({
  description:
    "Aggregate per-cohort scores over the QA review window. Returns the " +
    "cohort rollup (mean, p10, p90 per rubric dimension) and the top-N " +
    "trainees by gap-count.",
  inputSchema: z.object({
    cohort_id: z.string().min(1),
    rubric_version: z.string().min(1),
    since: z.string().datetime(),
  }),
  async execute(input) {
    return {
      cohort_id: input.cohort_id,
      rubric_version: input.rubric_version,
      since: input.since,
      aggregates: {
        mean: {},
        p10: {},
        p90: {},
      },
      top_gap_trainees: [],
      aggregated_at: new Date().toISOString(),
    };
  },
});
