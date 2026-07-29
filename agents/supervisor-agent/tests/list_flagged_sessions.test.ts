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
const FLAG_STATUSES = ["OPEN", "RESOLVED"] as const;
const FLAG_SEVERITIES = ["warning", "critical"] as const;

const SCHEMA = z.object({
  status: z.enum(FLAG_STATUSES).optional(),
  severity: z.enum(FLAG_SEVERITIES).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
});

async function execute(input: z.infer<typeof SCHEMA>) {
  const tagFilter: string[] = ["boundary_flag"];
  if (input.status) tagFilter.push(`flag_status:${input.status}`);

  const memories = await searchMemoriesMock({
    query: "boundary_flag clinical escalate",
    limit: input.limit * 2,
    tag_filter: tagFilter,
  });

  const flags: Array<{
    session_id: string;
    severity: string;
    flagged_criteria: string[];
    escalated: boolean;
    flagged_at: string;
  }> = [];

  for (const m of memories ?? []) {
    try {
      const parsed = JSON.parse(m.content) as {
        session_id?: string;
        severity?: string;
        flagged_risk_criteria?: string[];
        escalate_to_supervisor?: boolean;
        evaluated_at?: string;
      };
      if (input.severity && parsed.severity !== input.severity) continue;
      if (parsed.session_id && parsed.severity) {
        flags.push({
          session_id: parsed.session_id,
          severity: parsed.severity,
          flagged_criteria: parsed.flagged_risk_criteria ?? [],
          escalated: parsed.escalate_to_supervisor ?? false,
          flagged_at: parsed.evaluated_at ?? "unknown",
        });
      }
    } catch {
      /* skip */
    }
  }

  flags.sort((a, b) => new Date(b.flagged_at).getTime() - new Date(a.flagged_at).getTime());

  return {
    flags: flags.slice(0, input.limit),
    total: flags.length,
    filters: { status: input.status ?? null, severity: input.severity ?? null },
  };
}
// ---- CUT ----

describe("list_flagged_sessions", () => {
  beforeEach(() => {
    searchMemoriesMock.mockReset();
  });

  it("should return all flags sorted by date descending", async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          session_id: "s1",
          severity: "critical",
          flagged_risk_criteria: ["self-harm"],
          escalate_to_supervisor: true,
          evaluated_at: "2026-07-10T12:00:00Z",
        }),
      },
      {
        content: JSON.stringify({
          session_id: "s2",
          severity: "warning",
          flagged_risk_criteria: ["boundary-crossing"],
          escalate_to_supervisor: false,
          evaluated_at: "2026-07-15T12:00:00Z",
        }),
      },
    ]);

    const result = await execute({});
    expect(result.total).toBe(2);
    expect(result.flags[0].session_id).toBe("s2"); // newer first
    expect(result.flags[0].escalated).toBe(false);
    expect(result.flags[1].severity).toBe("critical");
  });

  it("should filter by severity", async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({
          session_id: "s1",
          severity: "critical",
          evaluated_at: "2026-07-10T12:00:00Z",
        }),
      },
      {
        content: JSON.stringify({
          session_id: "s2",
          severity: "warning",
          evaluated_at: "2026-07-15T12:00:00Z",
        }),
      },
    ]);

    const result = await execute({ severity: "critical" });
    expect(result.total).toBe(1);
    expect(result.flags[0].severity).toBe("critical");
  });

  it("should return empty when no flags exist", async () => {
    searchMemoriesMock.mockResolvedValue([]);
    const result = await execute({});
    expect(result.total).toBe(0);
    expect(result.flags).toHaveLength(0);
  });

  it("should respect limit", async () => {
    const manyFlags = Array.from({ length: 5 }, (_, i) => ({
      content: JSON.stringify({
        session_id: `s${i}`,
        severity: "warning",
        evaluated_at: `2026-07-${10 + i}T12:00:00Z`,
      }),
    }));
    searchMemoriesMock.mockResolvedValue(manyFlags);
    const result = await execute({ limit: 3 });
    expect(result.flags).toHaveLength(3);
  });
});
