import { generateText } from 'ai'
import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'

import { planTrainingJob } from '../lib/training-infra-client.js'
import { getModel } from '../lib/workers-ai.js'

interface RunEvaluationInput {
  candidate_model_id: string
  benchmark_suite_version: string
}

export default defineTool({
  description:
    'Run the evaluation benchmark suite on a training candidate. Produces ' +
    'structured per-benchmark scores plus an aggregated recommendation ' +
    '(promote / hold / reject). When Workers AI is available, runs a ' +
    'lightweight pre-evaluation pass. Behind always() approval because ' +
    'replays consume evaluator budget and produce durable eval records.',
  inputSchema: z.object({
    candidate_model_id: z.string().min(1),
    benchmark_suite_version: z.string().min(1),
  }),
  approval: always<RunEvaluationInput>(),
  async execute(input: RunEvaluationInput) {
    const model = getModel()
    let preEvalScore: number | null = null

    if (model) {
      try {
        const prompt =
          `You are a benchmark evaluator. Rate the expected quality of model ` +
          `"${input.candidate_model_id}" against benchmark suite version ` +
          `"${input.benchmark_suite_version}". Return only a JSON object with no markdown:\n` +
          `{"estimated_pass_rate":0.0-1.0,"confidence":0.0-1.0,"note":"max 120 chars"}`
        const { text } = await generateText({ model, prompt })
        const cleaned = (text.match(/\{[\s\S]*\}/) ?? [text])[0]
        const parsed = JSON.parse(cleaned) as {
          estimated_pass_rate?: unknown
        }
        preEvalScore =
          typeof parsed.estimated_pass_rate === 'number'
            ? Math.max(0, Math.min(1, parsed.estimated_pass_rate))
            : null
      } catch {
        // Pre-eval is advisory; swallow failures
      }
    }

    // Wire to the training-infra MCP: resolve (plan, do not launch) an eval
    // job for this candidate/suite. Planning is side-effect free; submission
    // happens separately via submit_job with the returned plan_hash.
    let trainingInfraPlan: Record<string, unknown> | null = null
    let planError: string | null = null
    try {
      const tag = `eval-${input.candidate_model_id}-${input.benchmark_suite_version}`
      // The recipe id pins the graded case suite (eval-crisis-v2 -> --suite v2),
      // so the suite version is NOT an input: passing it would be rejected, and
      // silently ignoring it would eval the wrong suite under the right label.
      const recipe =
        input.benchmark_suite_version === 'v1'
          ? 'eval-crisis-v1'
          : 'eval-crisis-v2'
      const planned = await planTrainingJob({
        recipe,
        inputs: { tag },
      })
      if (planned && planned.ok === true) {
        trainingInfraPlan = {
          plan_hash: planned.plan_hash,
          command: planned.command,
          est_cost_usd: planned.est_cost_usd,
          warnings: planned.warnings ?? [],
          recipe,
          tag,
        }
      } else if (planned && typeof planned.error === 'string') {
        planError = planned.error
      }
    } catch (err) {
      // Advisory: MCP may be unavailable; keep EVAL_REQUESTED state.
      planError = err instanceof Error ? err.message : String(err)
    }

    return {
      candidate_model_id: input.candidate_model_id,
      benchmark_suite_version: input.benchmark_suite_version,
      state: 'EVAL_REQUESTED',
      requested_at: new Date().toISOString(),
      workers_ai_pre_eval:
        preEvalScore !== null
          ? {
              estimated_pass_rate: preEvalScore,
              model: '@cf/mistralai/mistral-small-3.1-24b-instruct',
            }
          : null,
      training_infra_plan: trainingInfraPlan,
      plan_error: planError,
      note: trainingInfraPlan
        ? 'Eval plan resolved via training-infra MCP; submit with the returned plan_hash to launch.'
        : planError
          ? `Eval was not planned: ${planError}`
          : 'Training-infra MCP unreachable; eval not planned. Retry when the service is up.',
    }
  },
})
