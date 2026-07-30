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
vi.mock("../agent/foresight-client.js", () => ({
  storeMemory: (...args: unknown[]) => storeMemoryMock(...args),
  searchMemories: vi.fn(),
}));

// ---- CUT ----
const STEP_STATUSES = ["COMPLETED", "FAILED", "SKIPPED"] as const;

const inputSchema = z.object({
  trainee_id: z.string().uuid(),
  cohort_id: z.string().min(1),
  step_id: z.string().min(1),
  step_name: z.string().min(1).max(200),
  status: z.enum(STEP_STATUSES),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional(),
});

async function execute(input: z.infer<typeof inputSchema>) {
  const recordedAt = new Date().toISOString();

  const record = {
    type: "curriculum_step",
    trainee_id: input.trainee_id,
    cohort_id: input.cohort_id,
    step_id: input.step_id,
    step_name: input.step_name,
    status: input.status,
    score: input.score ?? null,
    notes: input.notes ?? null,
    recorded_at: recordedAt,
  };

  const stored = await storeMemoryMock({
    content: JSON.stringify(record),
    category: "curriculum",
    scope: "trainee",
    retention: "long_term",
    importance: 0.6,
    tags: [
      `trainee:${input.trainee_id}`,
      `cohort:${input.cohort_id}`,
      `step:${input.step_id}`,
      `step_status:${input.status}`,
    ],
  });

  return {
    trainee_id: input.trainee_id,
    step_id: input.step_id,
    step_name: input.step_name,
    status: input.status,
    recorded_at: recordedAt,
    foresight_memory: stored ?? {
      memory_id: null,
      note: "Foresight MCP write failed.",
    },
  };
}
// ---- CUT ----

describe("record_curriculum_step", () => {
  const validInput = {
    trainee_id: "550e8400-e29b-41d4-a716-446655440000",
    cohort_id: "CBT-2026-01",
    step_id: "MODULE-3-LESSON-5",
    step_name: "Cognitive Restructuring Practice",
    status: "COMPLETED" as const,
    score: 88,
  };

  beforeEach(() => {
    storeMemoryMock.mockReset();
    storeMemoryMock.mockResolvedValue({ memory_id: "mem_step_001" });
  });

  it("should record a curriculum step", async () => {
    const result = await execute(validInput);

    expect(result.trainee_id).toBe(validInput.trainee_id);
    expect(result.step_id).toBe("MODULE-3-LESSON-5");
    expect(result.status).toBe("COMPLETED");
    expect(result.step_name).toBe("Cognitive Restructuring Practice");
  });

  it("should store with correct tags", async () => {
    await execute(validInput);

    const call = storeMemoryMock.mock.calls[0][0];
    expect(call.tags).toContain("step_status:COMPLETED");
    expect(call.tags).toContain("step:MODULE-3-LESSON-5");
    expect(call.category).toBe("curriculum");
  });

  it("should record failed step with score 0", async () => {
    const result = await execute({
      ...validInput,
      status: "FAILED",
      score: 0,
      notes: "Trainee struggled with exposure hierarchy",
    });

    expect(result.status).toBe("FAILED");

    const stored = JSON.parse(storeMemoryMock.mock.calls[0][0].content);
    expect(stored.score).toBe(0);
    expect(stored.notes).toBe("Trainee struggled with exposure hierarchy");
  });

  it("should record skipped step without score", async () => {
    const result = await execute({
      ...validInput,
      status: "SKIPPED",
      score: undefined,
    });

    expect(result.status).toBe("SKIPPED");

    const stored = JSON.parse(storeMemoryMock.mock.calls[0][0].content);
    expect(stored.score).toBeNull();
  });

  it("should reject an invalid step status", () => {
    expect(() => {
      inputSchema.parse({ ...validInput, status: "IN_PROGRESS" });
    }).toThrow();
  });

  it("should reject a score above 100", () => {
    expect(() => {
      inputSchema.parse({ ...validInput, score: 150 });
    }).toThrow();
  });
});
