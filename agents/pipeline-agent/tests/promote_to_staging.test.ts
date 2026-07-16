import { createHash } from 'node:crypto'

import type { ToolContext } from 'eve/tools'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { searchMemories, storeMemory } from '../agent/foresight-client.js'
import promoteToStaging from '../agent/tools/promote_to_staging.js'

vi.mock('../agent/foresight-client.js', () => ({
  searchMemories: vi.fn(),
  storeMemory: vi.fn(),
  getSystemStatus: vi.fn(),
}))

const ctx = {} as ToolContext

beforeEach(() => {
  vi.clearAllMocks()
  ;(searchMemories as any).mockResolvedValue([
    { content: JSON.stringify({ session_ids: ['s1', 's2'] }), memory_id: 'm1' },
    { content: JSON.stringify({ session_ids: ['s3'] }), memory_id: 'm2' },
  ])
  ;(storeMemory as any).mockResolvedValue({ memory_id: 'stored-1' })
})

describe('promote_to_staging tool', () => {
  it('records provenance, derives a model card hash, and marks staging deploy', async () => {
    const result = await promoteToStaging.execute(
      {
        training_job_id: 'train-1',
        model_uri: 'models/my-model',
        image_tag: 'v1.2.3',
      },
      ctx,
    )
    expect(result.deploy_namespace).toBe('pixelated-staging')
    expect(result.training_provenance.model_card_hash).toBe(
      createHash('sha256')
        .update('models/my-model:v1.2.3')
        .digest('hex')
        .slice(0, 16),
    )
    expect(result.training_provenance.rehearsal_session_ids).toEqual([
      'm1',
      'm2',
    ])
    expect(result['_provenance_stored']).toBe(true)
    expect(searchMemories).toHaveBeenCalledTimes(2)
    expect(storeMemory).toHaveBeenCalledTimes(1)
    expect(storeMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'training_provenance',
        importance: 0.9,
      }),
    )
  })

  it('stores provenance even when Foresight returns no memories', async () => {
    ;(searchMemories as any).mockResolvedValue(null)
    const result = await promoteToStaging.execute(
      {
        training_job_id: 'train-2',
        model_uri: 'models/x',
        image_tag: 'v0.0.1',
      },
      ctx,
    )
    expect(result.training_provenance.rehearsal_session_ids).toEqual([])
    expect(result['_provenance_stored']).toBe(true)
  })
})
