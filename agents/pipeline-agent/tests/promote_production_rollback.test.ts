import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi } from 'vitest'

import { checkEvalGate } from '../agent/lib/training-infra-client.js'
import promoteToProduction from '../agent/tools/promote_to_production.js'
import rollbackModel from '../agent/tools/rollback_model.js'

vi.mock('../agent/lib/training-infra-client.js', () => ({
  checkEvalGate: vi.fn(),
}))

const ctx = {} as ToolContext

describe('promote_to_production tool', () => {
  it('records the production release and deploy target when the eval gate passes', async () => {
    vi.mocked(checkEvalGate).mockResolvedValue({
      ok: true,
      passed: true,
      reasons: [],
      min_delta: 0.02,
      min_pass_rate: 0.5,
      runs: { run1: { passed: true } },
    })
    const result = await promoteToProduction.execute(
      {
        staging_release_id: 'stg-1',
        image_tag: 'v1',
        release_notes: 'ship it',
      },
      ctx,
    )
    expect(result.deploy_target).toBe('docker_compose')
    expect(result.production_release_id).toMatch(/^release-/)
    expect(result.staging_release_id).toBe('stg-1')
    expect(result.promoted).toBe(true)
    expect(result.eval_gate?.passed).toBe(true)
  })

  it('refuses promotion when the eval gate fails', async () => {
    vi.mocked(checkEvalGate).mockResolvedValue({
      ok: true,
      passed: false,
      reasons: ['run1: delta sft-base 0.0100 < min 0.0200'],
      min_delta: 0.02,
      min_pass_rate: 0.5,
      runs: {},
    })
    const result = await promoteToProduction.execute(
      {
        staging_release_id: 'stg-2',
        image_tag: 'v2',
      },
      ctx,
    )
    expect(result.promoted).toBe(false)
    expect(result.blocked_by).toBe('eval_gate')
    expect(result.production_release_id).toBeUndefined()
  })
})

describe('rollback_model tool', () => {
  it('rolls back to the previous release and records the reason', async () => {
    const result = await rollbackModel.execute(
      {
        current_release_id: 'rel-2',
        previous_release_id: 'rel-1',
        reason: 'regression',
      },
      ctx,
    )
    expect(result.rolled_back_to).toBe('rel-1')
    expect(result.from_release).toBe('rel-2')
    expect(result.reason).toBe('regression')
  })
})
