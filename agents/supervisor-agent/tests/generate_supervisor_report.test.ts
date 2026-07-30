import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

function defineToolForTest<T extends z.ZodType>(opts: {
  description: string;
  inputSchema: T;
  execute: (input: z.infer<T>) => Promise<Record<string, unknown>>;
}) {
  return opts;
}

vi.mock("eve/tools", () => ({ defineTool: defineToolForTest }));

const storeMemoryMock = vi.fn();
const searchMemoriesMock = vi.fn();
vi.mock("../agent/foresight-client.js", () => ({
  storeMemory: (...args: unknown[]) => storeMemoryMock(...args),
  searchMemories: (...args: unknown[]) => searchMemoriesMock(...args),
}));

// ---- CUT ----
const REPORT_FORMATS = ["summary", "detailed"] as const;
const SCHEMA = z.object({
  cohort_id: z.string().optional(),
  time_range: z.object({ start: z.string(), end: z.string() }).optional(),
  format: z.enum(REPORT_FORMATS).optional().default("summary"),
});

async function execute(input: z.infer<typeof SCHEMA>) {
  const reportId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();

  const flagMemories = await searchMemoriesMock({
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

  const scoreMemories = await searchMemoriesMock({
    query: input.cohort_id ? `cohort_id:${input.cohort_id} score_record` : "score_record",
    limit: 100,
    tag_filter: input.cohort_id ? [`cohort_id:${input.cohort_id}`] : ["score_record"],
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
    metrics: {
      total_scored_sessions: scoredCount,
      total_flags: flags.length,
      critical_flags: flags.filter((f) => f.severity === "critical").length,
      dimension_averages: dimensionAverages,
    },
  };

  const stored = await storeMemoryMock({
    content: JSON.stringify(report),
    category: "supervisor_report",
    scope: "supervisor",
    retention: "long_term",
    importance: 0.7,
    tags: ["supervisor_report", ...(input.cohort_id ? [`cohort:${input.cohort_id}`] : [])],
  });

  return { report_id: reportId, generated_at: generatedAt, report };
}
// ---- CUT ----

describe("generate_supervisor_report", () => {
  beforeEach(() => {
    storeMemoryMock.mockReset();
    searchMemoriesMock.mockReset();
  });

  it("should generate a program-wide report", async () => {
    searchMemoriesMock
      .mockResolvedValueOnce([]) // no flags
      .mockResolvedValueOnce([]); // no scores

    const result = await execute({ format: "summary" });
    expect(result.report_id).toBeDefined();
    expect(result.report.cohort_id).toBeNull();
    expect(result.report.format).toBe("summary");
  });

  it("should include flag count in metrics", async () => {
    searchMemoriesMock
      .mockResolvedValueOnce([
        { content: JSON.stringify({ session_id: "s1", severity: "critical" }) },
        { content: JSON.stringify({ session_id: "s2", severity: "warning" }) },
      ])
      .mockResolvedValueOnce([]);

    const result = await execute({});
    expect(result.report.metrics.total_flags).toBe(2);
    expect(result.report.metrics.critical_flags).toBe(1);
  });

  it("should compute dimension averages from score records", async () => {
    searchMemoriesMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        content: JSON.stringify({
          state: "REVIEWED",
          dimensions: [
            { name: "rapport", score: 8 },
            { name: "empathy", score: 7 },
          ],
        }),
      },
      {
        content: JSON.stringify({
          state: "REVIEWED",
          dimensions: [
            { name: "rapport", score: 9 },
            { name: "empathy", score: 6 },
          ],
        }),
      },
    ]);

    const result = await execute({ cohort_id: "CBT-2026-01" });
    expect(result.report.metrics.total_scored_sessions).toBe(2);
    expect(result.report.metrics.dimension_averages.rapport).toBe(8.5);
    expect(result.report.metrics.dimension_averages.empathy).toBe(6.5);
  });

  it("should persist report to Foresight", async () => {
    searchMemoriesMock.mockResolvedValue([]).mockResolvedValue([]);
    storeMemoryMock.mockResolvedValue({ memory_id: "mem_report_001" });

    await execute({});
    expect(storeMemoryMock).toHaveBeenCalledTimes(1);
    const call = storeMemoryMock.mock.calls[0][0];
    expect(call.tags).toContain("supervisor_report");
    expect(call.retention).toBe("long_term");
  });
});
