import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import curateDataset from '../agent/tools/curate_dataset.js'
import promoteToProduction from '../agent/tools/promote_to_production.js'
import promoteToStaging from '../agent/tools/promote_to_staging.js'
import rollbackModel from '../agent/tools/rollback_model.js'
import runEvaluation from '../agent/tools/run_evaluation.js'
import runTraining from '../agent/tools/run_training.js'

vi.mock('../agent/foresight-client.js', () => ({
  searchMemories: vi.fn(),
  storeMemory: vi.fn(),
  getSystemStatus: vi.fn(),
}))
vi.mock('../agent/lib/workers-ai.js', () => ({
  getModel: vi.fn().mockReturnValue(null),
}))

import { searchMemories, storeMemory } from '../agent/foresight-client.js'

const ctx = {} as ToolContext

beforeEach(() => {
  vi.clearAllMocks()
  ;(searchMemories as any).mockResolvedValue([
    { content: '{}', memory_id: 'm1' },
  ])
  ;(storeMemory as any).mockResolvedValue({ memory_id: 'stored-1' })
})

describe('pipeline lifecycle (integration)', () => {
  it('curate -> train -> evaluate -> staging -> production -> rollback', async () => {
    const curated = await curateDataset.execute(
      { dataset_id: 'ds-1', include_synthetic: true },
      ctx,
    )
    expect(curated.curation_run_id).toMatch(/^curation-/)

    const trained = await runTraining.execute(
      {
        curation_run_id: curated.curation_run_id,
        model_id: 'mdl-1',
        method: 'dpo',
        hyperparams: { epochs: 3, batch_size: 8, learning_rate: 5e-5 },
      },
      ctx,
    )
    expect(trained.status).toBe('queued')

    const evaluated = await runEvaluation.execute(
      { candidate_model_id: 'mdl-1', benchmark_suite_version: 'v1' },
      ctx,
    )
    expect(evaluated.state).toBe('EVAL_REQUESTED')

    const staged = await promoteToStaging.execute(
      {
        training_job_id: trained.training_job_id,
        model_uri: 'models/mdl-1',
        image_tag: 'v1',
      },
      ctx,
    )
    expect(staged.deploy_namespace).toBe('pixelated-staging')
    expect(storeMemory).toHaveBeenCalled()

    const prod = await promoteToProduction.execute(
      { staging_release_id: staged.training_job_id, image_tag: 'v1' },
      ctx,
    )
    expect(prod.deploy_namespace).toBe('pixelated-prod')

    const rolled = await rollbackModel.execute(
      {
        current_release_id: prod.production_release_id,
        previous_release_id: 'rel-base',
        reason: 'smoke failure',
      },
      ctx,
    )
    expect(rolled.rolled_back_to).toBe('rel-base')
  })
})
