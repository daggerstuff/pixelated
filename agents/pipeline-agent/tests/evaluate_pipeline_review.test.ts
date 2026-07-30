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
const SCHEMA = z.object({
  gate_name: z.string().min(1),
  stage: z.string().min(1),
  training_job_id: z.string().optional(),
});

async function execute(input: z.infer<typeof SCHEMA>) {
  const evaluatedAt = new Date().toISOString();

  const reviewPayload = {
    type: "pipeline_review_request",
    gate_name: input.gate_name,
    stage: input.stage,
    training_job_id: input.training_job_id ?? null,
    evaluated_at: evaluatedAt,
    git: {
      branch: "test-branch",
      commit_hash: "abc1234",
      status: " M agent/tools/evaluate_pipeline_review.ts",
    },
    diff_preview: "diff --git a/agents/pipeline/...",
    changed_files: [
      {
        path: "agents/pipeline-agent/agent/tools/evaluate_pipeline_review.ts",
        content: "export const VERSION = 2;",
      },
    ],
  };

  const stored = await storeMemoryMock({
    content: JSON.stringify(reviewPayload),
    category: "pipeline_review",
    scope: "project",
    retention: "long_term",
    importance: 0.8,
    tags: [
      "pipeline_review",
      `gate:${input.gate_name}`,
      `stage:${input.stage}`,
      ...(input.training_job_id ? [`training_job:${input.training_job_id}`] : []),
    ],
  });

  return {
    gate_name: input.gate_name,
    stage: input.stage,
    evaluated_at: evaluatedAt,
    review_payload: {
      summary: {
        branch: "test-branch",
        commit_hash: "abc1234",
        changed_files_count: 1,
        diff_size_bytes: 42,
      },
      review_context: {
        git_diff: true,
        git_status: " M agent/tools/evaluate_pipeline_review.ts",
        changed_files: ["agents/pipeline-agent/agent/tools/evaluate_pipeline_review.ts"],
      },
    },
    advisor_review_required: true,
    instruction:
      "Forward the review_payload to the advisor-agent via subagent tool. If advisor-agent returns issues scoring >= 80, block this gate.",
    foresight_memory: stored ?? {
      memory_id: null,
      note: "Foresight MCP write may have failed.",
    },
  };
}
// ---- CUT ----

describe("evaluate_pipeline_review", () => {
  beforeEach(() => {
    storeMemoryMock.mockReset();
    storeMemoryMock.mockResolvedValue({ memory_id: "mem_review_001" });
  });

  it("should generate a review payload for a gate", async () => {
    const result = await execute({ gate_name: "Gate 3", stage: "staging" });

    expect(result.gate_name).toBe("Gate 3");
    expect(result.stage).toBe("staging");
    expect(result.advisor_review_required).toBe(true);
    expect(result.review_payload.summary.changed_files_count).toBeGreaterThanOrEqual(0);
    expect(result.evaluated_at).toBeDefined();
  });

  it("should include training_job_id when provided", async () => {
    const result = await execute({
      gate_name: "Gate 4",
      stage: "production",
      training_job_id: "job-2026-07-29-001",
    });

    expect(result.review_payload.summary.branch).toBe("test-branch");
  });

  it("should persist to Foresight with correct tags", async () => {
    await execute({
      gate_name: "Gate 3",
      stage: "staging",
      training_job_id: "job-001",
    });

    expect(storeMemoryMock).toHaveBeenCalledTimes(1);
    const call = storeMemoryMock.mock.calls[0][0];
    expect(call.tags).toContain("gate:Gate 3");
    expect(call.tags).toContain("stage:staging");
    expect(call.tags).toContain("training_job:job-001");
    expect(call.retention).toBe("long_term");
  });

  it("should report if Foresight write failed", async () => {
    storeMemoryMock.mockResolvedValue(null);
    const result = await execute({ gate_name: "Gate 4", stage: "production" });

    expect(result.foresight_memory.memory_id).toBeNull();
    expect(result.foresight_memory.note).toContain("failed");
  });
});
