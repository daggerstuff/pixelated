import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi } from 'vitest'

import runEvaluation from '../agent/tools/run_evaluation.js'

vi.mock('../agent/lib/workers-ai.js', () => ({
  getModel: vi.fn().mockReturnValue(null),
}))

vi.mock('../agent/lib/training-infra-client.js', () => ({
  planTrainingJob: vi.fn().mockResolvedValue({
    ok: true,
    plan_hash: 'plan-eval-1',
    command: 'python -m training.ovh_v22_eval.submit run --execute',
    est_cost_usd: 2.0,
    warnings: [],
  }),
}))

const ctx = {} as ToolContext

describe('run_evaluation tool', () => {
  it('requests evaluation and returns EVAL_REQUESTED state without a Workers AI pre-eval', async () => {
    const result = await runEvaluation.execute(
      { candidate_model_id: 'cand-1', benchmark_suite_version: 'v2' },
      ctx,
    )
    expect(result.state).toBe('EVAL_REQUESTED')
    expect(result.candidate_model_id).toBe('cand-1')
    expect(result.benchmark_suite_version).toBe('v2')
    expect(result.workers_ai_pre_eval).toBeNull()
    expect(result.training_infra_plan?.plan_hash).toBe('plan-eval-1')
  })

  it('keeps EVAL_REQUESTED but reports no plan when the MCP is unreachable', async () => {
    const { planTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    vi.mocked(planTrainingJob).mockResolvedValueOnce(null)
    const result = await runEvaluation.execute(
      { candidate_model_id: 'cand-2', benchmark_suite_version: 'v2' },
      ctx,
    )
    expect(result.state).toBe('EVAL_REQUESTED')
    expect(result.training_infra_plan).toBeNull()
  })
})
