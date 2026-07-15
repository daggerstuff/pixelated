import { describe, it, expect } from "vitest";
import type { ToolContext } from "eve/tools";

import runTraining from "../agent/tools/run_training.js";

const ctx = {} as ToolContext;

describe("run_training tool", () => {
  const base = {
    curation_run_id: "curation-abc123",
    model_id: "mdl-1",
    method: "dpo" as const,
    hyperparams: { epochs: 3, batch_size: 8, learning_rate: 5e-5 },
  };

  it("queues a training job and returns a train- prefixed id", async () => {
    const result = await runTraining.execute(base, ctx);
    expect(result.status).toBe("queued");
    expect(result.training_job_id).toMatch(/^train-/);
    expect(result.curation_run_id).toBe("curation-abc123");
    expect(result.model_id).toBe("mdl-1");
  });

  it("honors an explicit sft method", async () => {
    const result = await runTraining.execute({ ...base, method: "sft" }, ctx);
    expect(result.method).toBe("sft");
  });

  it("honors an explicit grpo method", async () => {
    const result = await runTraining.execute({ ...base, method: "grpo" }, ctx);
    expect(result.method).toBe("grpo");
  });
});
