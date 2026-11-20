import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import runTraining from '../agent/tools/run_training.js'

vi.mock('../agent/lib/training-infra-client.js', () => ({
  planTrainingJob: vi.fn().mockResolvedValue({
    ok: true,
    plan_hash: 'plan-train-1',
    command: 'python -m training.launch.make_launch_config',
    est_cost_usd: 12.5,
    warnings: [],
  }),
  submitTrainingJob: vi.fn().mockResolvedValue({
    ok: true,
    job_id: 'job-abc123def456',
    status: 'queued',
    plan_hash: 'plan-train-1',
  }),
}))

const ctx = {} as ToolContext

describe('run_training tool', () => {
  const base = {
    curation_run_id: 'curation-abc123',
    model_id: 'mdl-1',
    method: 'dpo' as const,
    hyperparams: { epochs: 3, batch_size: 8, learning_rate: 5e-5 },
    submit: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('plans but does not submit by default', async () => {
    const result = await runTraining.execute(base, ctx)
    const { submitTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    expect(submitTrainingJob).not.toHaveBeenCalled()
    expect(result.status).toBe('planned')
    expect(result.training_infra_job_id).toBeNull()
    expect(result.training_infra_plan?.plan_hash).toBe('plan-train-1')
    expect(result.curation_run_id).toBe('curation-abc123')
    expect(result.model_id).toBe('mdl-1')
  })

  it('submits the approved plan and returns the real registry job id', async () => {
    const result = await runTraining.execute({ ...base, submit: true }, ctx)
    const { submitTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    expect(submitTrainingJob).toHaveBeenCalledWith(
      expect.objectContaining({ plan_hash: 'plan-train-1' }),
    )
    expect(result.training_infra_job_id).toBe('job-abc123def456')
    expect(result.status).toBe('queued')
    expect(result.submit_error).toBeNull()
  })

  it('never fabricates a train- id', async () => {
    const planned = await runTraining.execute(base, ctx)
    const submitted = await runTraining.execute({ ...base, submit: true }, ctx)
    expect(planned).not.toHaveProperty('training_job_id')
    expect(submitted).not.toHaveProperty('training_job_id')
  })

  it('reports a submit rejection without inventing a job id', async () => {
    const { submitTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    vi.mocked(submitTrainingJob).mockResolvedValueOnce({
      ok: false,
      error: 'daily job cap reached',
    })
    const result = await runTraining.execute({ ...base, submit: true }, ctx)
    expect(result.training_infra_job_id).toBeNull()
    expect(result.submit_error).toBe('daily job cap reached')
    expect(result.status).toBe('planned')
  })

  it('never forwards the recipe-locked learning_rate override', async () => {
    // train-sft-latest locks learning_rate (invariant recipe_derived_lr), and
    // the MCP rejects the entire plan if it is sent. The LR schedule comes
    // from the launch config, so the caller's value must not be forwarded.
    const { planTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    await runTraining.execute(base, ctx)
    const arg = vi.mocked(planTrainingJob).mock.calls[0][0]
    expect(arg.overrides).toEqual({ epochs: 3 })
    expect(arg.overrides).not.toHaveProperty('learning_rate')
  })

  it('reports a plan rejected by the MCP instead of a fake plan', async () => {
    const { planTrainingJob, submitTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    vi.mocked(planTrainingJob).mockResolvedValueOnce({
      ok: false,
      error: "override 'learning_rate' is locked by recipe train-sft-latest",
    })
    const result = await runTraining.execute({ ...base, submit: true }, ctx)
    expect(result.training_infra_plan).toBeNull()
    expect(result.training_infra_job_id).toBeNull()
    expect(result.status).toBe('rejected')
    expect(result.submit_error).toContain('locked by recipe')
    expect(submitTrainingJob).not.toHaveBeenCalled()
  })

  it('honors an explicit sft method', async () => {
    const result = await runTraining.execute({ ...base, method: 'sft' }, ctx)
    expect(result.method).toBe('sft')
  })

  it('honors an explicit grpo method', async () => {
    const result = await runTraining.execute({ ...base, method: 'grpo' }, ctx)
    expect(result.method).toBe('grpo')
  })

  it('reports no job when the MCP is unreachable', async () => {
    const { planTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    vi.mocked(planTrainingJob).mockResolvedValueOnce(null)
    const result = await runTraining.execute({ ...base, submit: true }, ctx)
    expect(result.training_infra_job_id).toBeNull()
    expect(result.training_infra_plan).toBeNull()
    expect(result.status).toBe('unavailable')
  })
})
