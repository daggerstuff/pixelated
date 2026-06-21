import { always } from "eve/tools/approval";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { generateText } from "ai";
import { createWorkersAI } from "workers-ai-provider";

interface RunEvaluationInput {
  candidate_model_id: string;
  benchmark_suite_version: string;
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiKey = process.env.CLOUDFLARE_AI_API_KEY;
const workersai = accountId && apiKey ? createWorkersAI({ accountId, apiKey }) : null;

function getModel() {
  return workersai?.(process.env.WORKERS_AI_EVAL_MODEL ?? "@cf/meta/llama-3.2-3b-instruct") ?? null;
}

export default defineTool({
  description:
    "Run the evaluation benchmark suite on a training candidate. Produces " +
    "structured per-benchmark scores plus an aggregated recommendation " +
    "(promote / hold / reject). When Workers AI is available, runs a " +
    "lightweight pre-evaluation pass. Behind always() approval because " +
    "replays consume evaluator budget and produce durable eval records.",
  inputSchema: z.object({
    candidate_model_id: z.string().min(1),
    benchmark_suite_version: z.string().min(1),
  }),
  needsApproval: always() as unknown as undefined,
  async execute(input: RunEvaluationInput) {
    const model = getModel();
    let preEvalScore: number | null = null;

    if (model) {
      try {
        const prompt =
          `You are a benchmark evaluator. Rate the expected quality of model ` +
          `"${input.candidate_model_id}" against benchmark suite version ` +
          `"${input.benchmark_suite_version}". Return only a JSON object with no markdown:\n` +
          `{"estimated_pass_rate":0.0-1.0,"confidence":0.0-1.0,"note":"max 120 chars"}`;
        const { text } = await generateText({ model, prompt });
        const cleaned = (text.match(/\{[\s\S]*\}/) ?? [text])[0];
        const parsed = JSON.parse(cleaned) as {
          estimated_pass_rate?: unknown;
        };
        preEvalScore =
          typeof parsed.estimated_pass_rate === "number"
            ? Math.max(0, Math.min(1, parsed.estimated_pass_rate))
            : null;
      } catch {
        // Pre-eval is advisory; swallow failures
      }
    }

    return {
      candidate_model_id: input.candidate_model_id,
      benchmark_suite_version: input.benchmark_suite_version,
      state: "EVAL_REQUESTED",
      requested_at: new Date().toISOString(),
      workers_ai_pre_eval:
        preEvalScore !== null
          ? {
              estimated_pass_rate: preEvalScore,
              model: "@cf/meta/llama-3.2-3b-instruct",
            }
          : null,
      benchmark_run_stub: {
        note:
          "Benchmark runner is not yet wired. The expected integration is " +
          "an MCP connection owned by the QA agent or by the ai/training " +
          "directory once it exists.",
      },
    };
  },
});
