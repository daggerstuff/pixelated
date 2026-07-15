import { describe, it, expect, vi } from "vitest";
import type { ToolContext } from "eve/tools";

import runEvaluation from "../agent/tools/run_evaluation.js";

vi.mock("../agent/lib/workers-ai.js", () => ({
  getModel: vi.fn().mockReturnValue(null),
}));

const ctx = {} as ToolContext;

describe("run_evaluation tool", () => {
  it("requests evaluation and returns EVAL_REQUESTED state without a Workers AI pre-eval", async () => {
    const result = await runEvaluation.execute(
      { candidate_model_id: "cand-1", benchmark_suite_version: "v2" },
      ctx,
    );
    expect(result.state).toBe("EVAL_REQUESTED");
    expect(result.candidate_model_id).toBe("cand-1");
    expect(result.benchmark_suite_version).toBe("v2");
    expect(result.workers_ai_pre_eval).toBeNull();
  });
});
