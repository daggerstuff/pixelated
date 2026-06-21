import { defineTool } from "eve/tools";
import { z } from "zod";

// Launch SFT/DPO/GRPO training via training-infra MCP. Returns the job id
// so the orchestrator can poll progress.

interface RunTrainingInput {
  curation_run_id: string;
  model_id: string;
  method: "sft" | "dpo" | "grpo";
  hyperparams: {
    epochs: number;
    batch_size: number;
    learning_rate: number;
  };
}

export default defineTool({
  description:
    "Launch an SFT/DPO/GRPO training job on the training infrastructure. " +
    "Returns the training_job_id for downstream monitoring. The orchestrator " +
    "polls the training-infra MCP status endpoint with this id.",
  inputSchema: z.object({
    curation_run_id: z.string().min(1),
    model_id: z.string().min(1),
    method: z.enum(["sft", "dpo", "grpo"]).default("dpo"),
    hyperparams: z
      .object({
        epochs: z.number().int().min(1).max(100).default(3),
        batch_size: z.number().int().min(1).max(512).default(8),
        learning_rate: z.number().min(1e-7).max(1).default(5e-5),
      })
      .default(() => ({ epochs: 3, batch_size: 8, learning_rate: 5e-5 })),
  }),
  async execute(input: RunTrainingInput) {
    return {
      training_job_id: `train-${Date.now().toString(36)}`,
      curation_run_id: input.curation_run_id,
      model_id: input.model_id,
      method: input.method,
      status: "queued",
      started_at: new Date().toISOString(),
      training_infra_stub: {
        note:
          "training-infra-mcp tool `launch_training` is not yet wired. " +
          "When wired, the orchestrator should poll its status every 60s.",
      },
    };
  },
});
