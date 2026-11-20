import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi } from 'vitest'

import curateDataset from '../agent/tools/curate_dataset.js'

vi.mock('../agent/lib/training-infra-client.js', () => ({
  planTrainingJob: vi.fn().mockResolvedValue({
    ok: true,
    plan_hash: 'plan-curate-1',
    command: 'python -m training.build_agent_tool_sft_v30',
    est_cost_usd: 0,
    warnings: [],
  }),
}))

const ctx = {} as ToolContext

describe('curate_dataset tool', () => {
  it('returns a curation- prefixed run id and echoes dataset id', async () => {
    const result = await curateDataset.execute(
      { dataset_id: 'ds-42', include_synthetic: true },
      ctx,
    )
    expect(result.curation_run_id).toMatch(/^curation-/)
    expect(result.dataset_id).toBe('ds-42')
    expect(result.include_synthetic).toBe(true)
    expect(result.cohort_id).toBeNull()
  })

  it('passes through an optional cohort id', async () => {
    const result = await curateDataset.execute(
      { dataset_id: 'ds-43', cohort_id: 'cohort-9', include_synthetic: false },
      ctx,
    )
    expect(result.cohort_id).toBe('cohort-9')
    expect(result.include_synthetic).toBe(false)
  })

  it('reports a null plan when the MCP is unreachable', async () => {
    const { planTrainingJob } =
      await import('../agent/lib/training-infra-client.js')
    vi.mocked(planTrainingJob).mockResolvedValueOnce(null)
    const result = await curateDataset.execute(
      { dataset_id: 'ds-44', include_synthetic: true },
      ctx,
    )
    expect(result.curation_run_id).toMatch(/^curation-/)
    expect(result.training_infra_plan).toBeNull()
  })
})
