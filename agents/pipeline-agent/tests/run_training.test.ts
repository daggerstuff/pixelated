import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi } from 'vitest'

import runTraining from '../agent/tools/run_training.js'

vi.mock('../agent/lib/training-infra-client.js', () => ({
  planTrainingJob: vi.fn().mockResolvedValue({
    ok: true,
    plan_hash: 'plan-train-1',
    command: 'python -m training.launch.make_launch_config',
    est_cost_usd: 12.5,
    warnings: [],
  }),
}))

const ctx = {} as ToolContext

describe('run_training tool', () => {
  const base = {
    curation_run_id: 'curation-abc123',
    model_id: 'mdl-1',
    method: 'dpo' as const,
    hyperparams: { epochs: 3, batch_size: 8, learning_rate: 5e-5 },
  }

  it('queues a training job and returns a train- prefixed id', async () => {
    const result = await runTraining.execute(base, ctx)
    expect(result.status).toBe('queued')
    expect(result.training_job_id).toMatch(/^train-/)
    expect(result.curation_run_id).toBe('curation-abc123')
    expect(result.model_id).toBe('mdl-1')
    expect(result.training_infra_plan?.plan_hash).toBe('plan-train-1')
  })

  it('honors an explicit sft method', async () => {
    const result = await runTraining.execute({ ...base, method: 'sft' }, ctx)
    expect(result.method).toBe('sft')
  })

  it('honors an explicit grpo method', async () => {
    const result = await runTraining.execute({ ...base, method: 'grpo' }, ctx)
    expect(result.method).toBe('grpo')
  })

  it('never reports a job id when the MCP is unreachable (plan-only tool)', async () => {
    const { planTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    vi.mocked(planTrainingJob).mockResolvedValueOnce(null)
    const result = await runTraining.execute(base, ctx)
    expect(result.training_infra_job_id).toBeNull()
    expect(result.training_infra_plan).toBeNull()
  })
})
