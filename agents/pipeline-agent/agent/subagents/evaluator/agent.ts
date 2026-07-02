import { defineAgent } from "eve";
import { z } from "zod";

export default defineAgent({
  description:
    "Specialist sub-agent that analyzes evaluation benchmark results and " +
    "emits dimension-level pass/fail, an overall verdict, and a recommendation " +
    "for the human reviewer at Gate 3. Workers AI pre-evaluation scoring lives " +
    "in the `run_evaluation` tool, not at the model layer.",
  model: "anthropic/claude-sonnet-4.6",
  outputSchema: z.object({
    verdict: z.enum(["pass", "conditional_pass", "fail"]),
    dimensions: z.array(
      z.object({
        benchmark: z.string(),
        score: z.number().min(0).max(1),
        passed: z.boolean(),
        note: z.string().max(280),
      }),
    ),
    recommendation: z.string().max(500),
  }),
});
