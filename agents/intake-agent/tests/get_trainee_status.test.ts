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
  trainee_id: z.string().uuid(),
});

async function execute(input: z.infer<typeof inputSchema>) {
  const memories = await searchMemoriesMock({
    query: `trainee:${input.trainee_id}`,
    limit: 50,
    tag_filter: [`trainee:${input.trainee_id}`],
  });

  if (!memories || memories.length === 0) {
    return { trainee_id: input.trainee_id, status: "NOT_FOUND", records: 0 };
  }

  let profile: Record<string, unknown> | null = null;
  const cohortAssignments: Array<Record<string, unknown>> = [];

  for (const m of memories) {
    try {
      const parsed = JSON.parse(m.content) as Record<string, unknown>;
      if (parsed.type === "trainee_profile") profile = parsed;
      else if (parsed.type === "cohort_assignment") cohortAssignments.push(parsed);
    } catch {
      /* skip */
    }
  }

  return {
    trainee_id: input.trainee_id,
    status: (profile?.status as string) ?? "UNKNOWN",
    profile: profile ?? null,
    cohort_assignments: cohortAssignments,
    records: memories.length,
  };
}
// ---- CUT ----

describe("get_trainee_status", () => {
  const TRAINEE_ID = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    searchMemoriesMock.mockReset();
  });

  it("should return NOT_FOUND for unknown trainee", async () => {
    searchMemoriesMock.mockResolvedValue([]);
    const result = await execute({ trainee_id: TRAINEE_ID });
    expect(result.status).toBe("NOT_FOUND");
    expect(result.records).toBe(0);
  });

  it("should return trainee status and profile", async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          type: "trainee_profile",
          status: "ACTIVE",
          name: "Dr. Chen",
        }),
      },
    ]);

    const result = await execute({ trainee_id: TRAINEE_ID });
    expect(result.status).toBe("ACTIVE");
    expect((result.profile as Record<string, unknown>).name).toBe("Dr. Chen");
  });

  it("should return cohort assignments", async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({ type: "trainee_profile", status: "ACTIVE" }),
      },
      {
        content: JSON.stringify({
          type: "cohort_assignment",
          cohort_id: "CBT-2026-01",
        }),
      },
      {
        content: JSON.stringify({
          type: "cohort_assignment",
          cohort_id: "ADV-TRAUMA-01",
        }),
      },
    ]);

    const result = await execute({ trainee_id: TRAINEE_ID });
    expect(result.cohort_assignments).toHaveLength(2);
  });

  it("should skip malformed records", async () => {
    searchMemoriesMock.mockResolvedValue([
      { content: "not-json" },
      {
        content: JSON.stringify({ type: "trainee_profile", status: "ACTIVE" }),
      },
    ]);

    const result = await execute({ trainee_id: TRAINEE_ID });
    expect(result.status).toBe("ACTIVE");
    expect(result.records).toBe(2);
  });
});
