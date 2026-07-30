import { defineTool } from "eve/tools";
import { z } from "zod";

import { storeMemory, searchMemories } from "../foresight-client.js";

const REPORT_FORMATS = ["summary", "detailed"] as const;

const SCHEMA = z.object({
  cohort_id: z.string().optional().describe("Cohort to report on. Omit for program-wide."),
  time_range: z
    .object({
      start: z.string().describe("ISO date for range start."),
      end: z.string().describe("ISO date for range end."),
    })
    .optional()
    .describe("Date range for the report."),
  format: z.enum(REPORT_FORMATS).optional().default("summary").describe("Report verbosity."),
});

export default defineTool({
  description:
    "Compose a supervisor-facing report covering cohort progress, flagged sessions, " +
    "and trend data. Can be posted to Slack or filed as a Linear document. Persists " +
    "the report to Foresight for audit.",
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const reportId = crypto.randomUUID();
    const generatedAt = new Date().toISOString();

    // Gather cohort data
    let cohortData: Record<string, unknown> | null = null;
    if (input.cohort_id) {
      const cohortMemories = await searchMemories({
        query: `cohort:${input.cohort_id}`,
        limit: 10,
        tag_filter: [`cohort:${input.cohort_id}`],
      });
      if (cohortMemories && cohortMemories.length > 0) {
        try {
          cohortData = JSON.parse(cohortMemories[0].content) as Record<string, unknown>;
        } catch {
          /* ignore */
        }
      }
    }

    // Gather recent flags
    const flagMemories = await searchMemories({
      query: "boundary_flag clinical",
      limit: 20,
      tag_filter: ["boundary_flag"],
    });

    const flags: Array<Record<string, unknown>> = [];
    for (const m of flagMemories ?? []) {
      try {
        const parsed = JSON.parse(m.content) as Record<string, unknown>;
        if (parsed.severity) flags.push(parsed);
      } catch {
        /* skip */
      }
    }

    // Gather recent score records
    const query = input.cohort_id ? `cohort_id:${input.cohort_id} score_record` : "score_record";
    const tagFilter = input.cohort_id ? [`cohort_id:${input.cohort_id}`] : ["score_record"];

    const scoreMemories = await searchMemories({
      query,
      limit: 100,
      tag_filter: tagFilter,
    });

    const dimensions = new Map<string, number[]>();
    let scoredCount = 0;

    for (const m of scoreMemories ?? []) {
      try {
        const parsed = JSON.parse(m.content) as {
          state?: string;
          dimensions?: Array<{ name: string; score: number }>;
        };
        if (parsed.state === "REVIEWED" && parsed.dimensions) {
          scoredCount++;
          for (const d of parsed.dimensions) {
            if (!dimensions.has(d.name)) dimensions.set(d.name, []);
            dimensions.get(d.name)!.push(d.score);
          }
        }
      } catch {
        /* skip */
      }
    }

    const dimensionAverages: Record<string, number> = {};
    for (const [name, vals] of dimensions) {
      dimensionAverages[name] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    const report = {
      type: "supervisor_report",
      report_id: reportId,
      cohort_id: input.cohort_id ?? null,
      format: input.format,
      generated_at: generatedAt,
      time_range: input.time_range ?? null,
      cohort: cohortData,
      metrics: {
        total_scored_sessions: scoredCount,
        total_flags: flags.length,
        critical_flags: flags.filter((f) => (f as Record<string, unknown>).severity === "critical")
          .length,
        dimension_averages: dimensionAverages,
      },
    };

    // Persist the report
    const stored = await storeMemory({
      content: JSON.stringify(report),
      category: "supervisor_report",
      scope: "supervisor",
      retention: "long_term",
      importance: 0.7,
      tags: ["supervisor_report", ...(input.cohort_id ? [`cohort:${input.cohort_id}`] : [])],
    });

    return {
      report_id: reportId,
      generated_at: generatedAt,
      report,
      foresight_memory: stored ?? {
        memory_id: null,
        note: "Foresight MCP write may have failed.",
      },
    };
  },
});
