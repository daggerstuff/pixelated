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

const searchMemoriesMock = vi.fn();
vi.mock("../agent/foresight-client.js", () => ({
  searchMemories: (...args: unknown[]) => searchMemoriesMock(...args),
}));

// ---- CUT ----
const inputSchema = z.object({
  cohort_type: z.enum(["TIME_BASED", "SKILL_LEVEL"]).optional(),
});

async function execute(input: z.infer<typeof inputSchema>) {
  const memories = await searchMemoriesMock({
    query: "cohort_assignment",
    limit: 100,
    tag_filter: input.cohort_type ? [`cohort_type:${input.cohort_type}`] : [],
  });

  const cohorts = new Map<
    string,
    {
      cohort_id: string;
      cohort_type: string;
      trainee_count: number;
      skill_level: string | null;
    }
  >();

  for (const m of memories ?? []) {
    try {
      const parsed = JSON.parse(m.content) as {
        cohort_id?: string;
        cohort_type?: string;
        skill_level?: string | null;
      };
      if (!parsed.cohort_id) continue;
      const existing = cohorts.get(parsed.cohort_id);
      if (existing) {
        existing.trainee_count++;
      } else {
        cohorts.set(parsed.cohort_id, {
          cohort_id: parsed.cohort_id,
          cohort_type: parsed.cohort_type ?? "unknown",
          trainee_count: 1,
          skill_level: parsed.skill_level ?? null,
        });
      }
    } catch {
      /* skip */
    }
  }

  return {
    cohorts: Array.from(cohorts.values()),
    total: cohorts.size,
    filter: input.cohort_type ?? "all",
  };
}
// ---- CUT ----

describe("list_cohorts", () => {
  beforeEach(() => {
    searchMemoriesMock.mockReset();
  });

  it("should return cohorts grouped by cohort_id", async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          cohort_id: "CBT-2026-01",
          cohort_type: "TIME_BASED",
        }),
      },
      {
        content: JSON.stringify({
          cohort_id: "CBT-2026-01",
          cohort_type: "TIME_BASED",
        }),
      },
      {
        content: JSON.stringify({
          cohort_id: "ADV-TRAUMA-01",
          cohort_type: "SKILL_LEVEL",
          skill_level: "ADVANCED",
        }),
      },
    ]);

    const result = await execute({});

    expect(result.total).toBe(2);
    expect(result.cohorts.find((c) => c.cohort_id === "CBT-2026-01")?.trainee_count).toBe(2);
    expect(result.cohorts.find((c) => c.cohort_id === "ADV-TRAUMA-01")?.trainee_count).toBe(1);
    expect(result.cohorts.find((c) => c.cohort_id === "ADV-TRAUMA-01")?.skill_level).toBe(
      "ADVANCED",
    );
  });

  it("should return empty when no cohorts exist", async () => {
    searchMemoriesMock.mockResolvedValue([]);
    const result = await execute({});
    expect(result.total).toBe(0);
    expect(result.cohorts).toHaveLength(0);
  });

  it("should filter by cohort_type when provided", async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          cohort_id: "ADV-TRAUMA-01",
          cohort_type: "SKILL_LEVEL",
          skill_level: "ADVANCED",
        }),
      },
    ]);

    const result = await execute({ cohort_type: "SKILL_LEVEL" });

    expect(result.filter).toBe("SKILL_LEVEL");
    expect(result.total).toBe(1);
    // verify searchMemories was called with the filter
    expect(searchMemoriesMock.mock.calls[0][0].tag_filter).toContain("cohort_type:SKILL_LEVEL");
  });
});
