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

  it('selects the recipe that pins the requested suite version', async () => {
    // The graded suite is recipe identity, not an input: v1 must route to
    // eval-crisis-v1 and anything else to eval-crisis-v2, with no `suite` input.
    const { planTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    await runEvaluation.execute(
      { candidate_model_id: 'cand-v1', benchmark_suite_version: 'v1' },
      ctx,
    )
    expect(vi.mocked(planTrainingJob).mock.calls[0][0]).toMatchObject({
      recipe: 'eval-crisis-v1',
      inputs: { tag: 'eval-cand-v1-v1' },
    })
    vi.mocked(planTrainingJob).mockClear()
    await runEvaluation.execute(
      { candidate_model_id: 'cand-v2', benchmark_suite_version: 'v2' },
      ctx,
    )
    expect(vi.mocked(planTrainingJob).mock.calls[0][0]).toMatchObject({
      recipe: 'eval-crisis-v2',
      inputs: { tag: 'eval-cand-v2-v2' },
    })
    const inputs = vi.mocked(planTrainingJob).mock.calls[0][0].inputs
    expect(inputs).not.toHaveProperty('suite')
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
