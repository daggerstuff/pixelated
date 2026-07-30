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
const TRAINEE_STATUSES = ["ACTIVE", "PAUSED", "SUSPENDED", "WITHDRAWN"] as const;
const SCHEMA = z.object({
  trainee_id: z.string().uuid(),
  new_status: z.enum(TRAINEE_STATUSES),
  reason: z.string().min(1).max(500),
});

async function execute(input: z.infer<typeof SCHEMA>) {
  const changedAt = new Date().toISOString();
  const changeRecord: Record<string, unknown> = {
    type: "trainee_status_change",
    trainee_id: input.trainee_id,
    previous_status: null,
    new_status: input.new_status,
    reason: input.reason,
    changed_by: "supervisor-agent",
    changed_at: changedAt,
  };

  const currentMemories = await searchMemoriesMock({
    query: `trainee:${input.trainee_id} intake`,
    limit: 5,
    tag_filter: [`trainee:${input.trainee_id}`],
  });

  for (const m of currentMemories ?? []) {
    try {
      const parsed = JSON.parse(m.content) as { type?: string; status?: string };
      if (parsed.type === "trainee_profile") {
        changeRecord.previous_status = parsed.status ?? "UNKNOWN";
      }
    } catch {
      /* skip */
    }
  }

  const stored = await storeMemoryMock({
    content: JSON.stringify(changeRecord),
    category: "trainee_status",
    scope: "trainee",
    retention: "long_term",
    importance: 0.9,
    tags: [`trainee:${input.trainee_id}`, "supervisor_action", `status_change:${input.new_status}`],
  });

  return {
    trainee_id: input.trainee_id,
    previous_status: changeRecord.previous_status,
    new_status: input.new_status,
    reason: input.reason,
    changed_at: changedAt,
  };
}
// ---- CUT ----

describe("adjust_trainee_status", () => {
  const TID = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    storeMemoryMock.mockReset();
    searchMemoriesMock.mockReset();
    searchMemoriesMock.mockResolvedValue([]); // no previous status by default
    storeMemoryMock.mockResolvedValue({ memory_id: "mem_status_001" });
  });

  it("should change trainee status and return the result", async () => {
    const result = await execute({
      trainee_id: TID,
      new_status: "PAUSED",
      reason: "Trainee requested leave",
    });
    expect(result.trainee_id).toBe(TID);
    expect(result.new_status).toBe("PAUSED");
    expect(result.reason).toBe("Trainee requested leave");
    expect(result.previous_status).toBeNull();
  });

  it("should detect previous status from existing profile", async () => {
    searchMemoriesMock.mockResolvedValue([
      {
        content: JSON.stringify({ type: "trainee_profile", status: "ACTIVE" }),
      },
    ]);

    const result = await execute({
      trainee_id: TID,
      new_status: "SUSPENDED",
      reason: "Ethical concern flagged",
    });
    expect(result.previous_status).toBe("ACTIVE");
  });

  it("should store with correct tags", async () => {
    await execute({
      trainee_id: TID,
      new_status: "WITHDRAWN",
      reason: "Completed program",
    });

    const call = storeMemoryMock.mock.calls[0][0];
    expect(call.tags).toContain("status_change:WITHDRAWN");
    expect(call.tags).toContain("supervisor_action");
    expect(call.retention).toBe("long_term");
    expect(call.importance).toBe(0.9);
  });

  it("should reject invalid status", () => {
    expect(() => {
      SCHEMA.parse({ trainee_id: TID, new_status: "UNKNOWN", reason: "test" });
    }).toThrow();
  });

  it("should reject empty reason", () => {
    expect(() => {
      SCHEMA.parse({ trainee_id: TID, new_status: "PAUSED", reason: "" });
    }).toThrow();
  });
});
