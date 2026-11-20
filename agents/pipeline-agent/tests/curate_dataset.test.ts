import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import curateDataset from '../agent/tools/curate_dataset.js'

vi.mock('../agent/lib/training-infra-client.js', () => ({
  planTrainingJob: vi.fn().mockResolvedValue({
    ok: true,
    plan_hash: 'plan-curate-1',
    command: 'python -m training.build_agent_tool_sft_v30',
    est_cost_usd: 0,
    warnings: [],
  }),
  submitTrainingJob: vi.fn().mockResolvedValue({
    ok: true,
    job_id: 'job-curate9876',
    status: 'queued',
    plan_hash: 'plan-curate-1',
  }),
}))

const ctx = {} as ToolContext

describe('curate_dataset tool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const base = {
    dataset_id: 'ds-42',
    include_synthetic: true,
    submit: false,
  }

  it('plans but does not submit by default', async () => {
    const result = await curateDataset.execute(base, ctx)
    const { submitTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    expect(submitTrainingJob).not.toHaveBeenCalled()
    expect(result.status).toBe('planned')
    expect(result.training_infra_job_id).toBeNull()
    expect(result.dataset_id).toBe('ds-42')
    expect(result.include_synthetic).toBe(true)
    expect(result.cohort_id).toBeNull()
  })

  it('submits the approved plan and returns the real registry job id', async () => {
    const result = await curateDataset.execute({ ...base, submit: true }, ctx)
    const { submitTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    expect(submitTrainingJob).toHaveBeenCalledWith(
      expect.objectContaining({ plan_hash: 'plan-curate-1' }),
    )
    expect(result.training_infra_job_id).toBe('job-curate9876')
    expect(result.status).toBe('queued')
  })

  it('never fabricates a curation- run id', async () => {
    const result = await curateDataset.execute({ ...base, submit: true }, ctx)
    expect(result).not.toHaveProperty('curation_run_id')
  })

  it('passes through an optional cohort id', async () => {
    const result = await curateDataset.execute(
      {
        dataset_id: 'ds-43',
        cohort_id: 'cohort-9',
        include_synthetic: false,
        submit: false,
      },
      ctx,
    )
    expect(result.cohort_id).toBe('cohort-9')
    expect(result.include_synthetic).toBe(false)
  })

  it('reports a submit rejection without inventing a job id', async () => {
    const { submitTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    vi.mocked(submitTrainingJob).mockResolvedValueOnce({
      ok: false,
      error: 'plan_hash not found or expired; re-run plan_job',
    })
    const result = await curateDataset.execute({ ...base, submit: true }, ctx)
    expect(result.training_infra_job_id).toBeNull()
    expect(result.submit_error).toBe(
      'plan_hash not found or expired; re-run plan_job',
    )
    expect(result.status).toBe('planned')
  })

  it('reports no job when the MCP is unreachable', async () => {
    const { planTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    vi.mocked(planTrainingJob).mockResolvedValueOnce(null)
    const result = await curateDataset.execute({ ...base, submit: true }, ctx)
    expect(result.training_infra_job_id).toBeNull()
    expect(result.training_infra_plan).toBeNull()
    expect(result.status).toBe('unavailable')
  })
})
