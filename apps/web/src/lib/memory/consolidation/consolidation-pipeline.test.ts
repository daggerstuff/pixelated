import type { UnifiedMemory } from '@pixelated/memory-schema'
import { describe, test, expect, vi } from 'vitest'

import type { ProductMemoryGateway } from '@/lib/services/product-memory-gateway'

import { ConsolidationPipeline } from './consolidation-pipeline'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let nextId = 1
function makeMemory(overrides: Partial<UnifiedMemory> = {}): UnifiedMemory {
  const id = overrides.id ?? `mem_${nextId++}`
  return {
    id,
    content: overrides.content ?? 'default test content',
    userId: overrides.userId ?? 'user_1',
    tenantId: overrides.tenantId ?? 'tenant_1',
    bankId: overrides.bankId ?? 'default',
    scope: overrides.scope ?? 'session',
    retention: overrides.retention ?? 'short_term',
    category: overrides.category ?? 'general',
    tags: overrides.tags ?? [],
    version: overrides.version ?? 1,
    schemaVersion: overrides.schemaVersion ?? '1.0.0',
    sourceService: overrides.sourceService ?? 'foresight',
    importance: overrides.importance ?? 0.5,
    decayRate: overrides.decayRate ?? 0.01,
    strengthTrend: overrides.strengthTrend ?? 'stable',
    activationCount: overrides.activationCount ?? 0,
    retrievalCount: overrides.retrievalCount ?? 0,
    isGhost: overrides.isGhost ?? false,
    gist: overrides.gist ?? null,
    synthesizedFrom: overrides.synthesizedFrom ?? [],
    vectorId: overrides.vectorId ?? null,
    emotionalContext: overrides.emotionalContext ?? null,
    empathyMetrics: overrides.empathyMetrics ?? null,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: overrides.updatedAt ?? null,
    accessedAt: overrides.accessedAt ?? null,
    lastRetrievedAt: overrides.lastRetrievedAt ?? null,
  }
}

function mockGateway(memories: UnifiedMemory[]): ProductMemoryGateway {
  const store = new Map(memories.map((m) => [m.id, { ...m }]))
  return {
    createMemory: vi.fn(),
    listMemories: vi.fn(async ({ limit = 100, offset = 0 }) => {
      const all = [...store.values()]
      return {
        memories: all.slice(offset, offset + limit),
        total: all.length,
      }
    }),
    searchMemories: vi.fn(),
    getMemory: vi.fn(async ({ memoryId }) => store.get(memoryId) ?? null),
    updateMemory: vi.fn(async ({ memoryId, content, metadata }) => {
      const existing = store.get(memoryId)
      if (existing) {
        const updated = { ...existing, content, metadata }
        store.set(memoryId, updated)
        return updated
      }
      throw new Error('not found')
    }),
    deleteMemory: vi.fn(async ({ memoryId }) => {
      store.delete(memoryId)
    }),
    getMemoryStats: vi.fn(),
  } as unknown as ProductMemoryGateway
}

// ---------------------------------------------------------------------------
// Dedup
// ---------------------------------------------------------------------------

describe('ConsolidationPipeline — dedup', () => {
  const pipeline = new ConsolidationPipeline({ dedupThreshold: 0.92 })

  test('no-op on empty list', async () => {
    const gateway = mockGateway([])
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.totalBefore).toBe(0)
    expect(report.totalAfterDedup).toBe(0)
    expect(report.mergedIds).toEqual([])
  })

  test('no-op on distinct content', async () => {
    const memories = [
      makeMemory({
        id: 'm1',
        content: 'the patient reported anxiety about work deadlines',
      }),
      makeMemory({
        id: 'm2',
        content: 'follow-up scheduled for next week Tuesday morning',
      }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.totalBefore).toBe(2)
    expect(report.totalAfterDedup).toBe(2)
    expect(report.mergedIds).toEqual([])
  })

  test('merges near-duplicate content keeping highest importance', async () => {
    const memories = [
      makeMemory({
        id: 'm1',
        content:
          'client mentioned feeling anxious about the upcoming performance review at work',
        importance: 0.5,
      }),
      makeMemory({
        id: 'm2',
        content:
          'client mentioned feeling anxious about the upcoming performance review at work',
        importance: 0.8,
      }),
      makeMemory({
        id: 'm3',
        content: 'enjoyed a relaxing weekend hiking in the mountains',
        importance: 0.6,
      }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    // m1 and m2 are near-duplicates (identical content) → m2 kept (higher importance), m1 merged
    expect(report.totalBefore).toBe(3)
    expect(report.totalAfterDedup).toBe(2)
    expect(report.mergedIds).toEqual(['m1'])
  })

  test('merges multiple near-duplicate clusters', async () => {
    const memories = [
      makeMemory({
        id: 'm1',
        content: 'feeling anxious about the job interview',
        importance: 0.5,
      }),
      makeMemory({
        id: 'm2',
        content: 'feeling anxious about the job interview',
        importance: 0.6,
      }),
      makeMemory({
        id: 'm3',
        content: 'had a great time at the party last night',
        importance: 0.7,
      }),
      makeMemory({
        id: 'm4',
        content: 'had a great time at the party last night',
        importance: 0.4,
      }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    // Two clusters of 2 each
    expect(report.totalBefore).toBe(4)
    expect(report.totalAfterDedup).toBe(2)
    expect(report.mergedIds).toHaveLength(2)
    // m2 kept (0.6 > 0.5), m1 merged. m3 kept (0.7 > 0.4), m4 merged
    expect(report.mergedIds).toContain('m1')
    expect(report.mergedIds).toContain('m4')
  })
})

// ---------------------------------------------------------------------------
// Cross-linking (REM dreaming)
// ---------------------------------------------------------------------------

describe('ConsolidationPipeline — cross-linking', () => {
  const pipeline = new ConsolidationPipeline({ crosslinkThreshold: 0.7 })

  test('discovers cross-links between semantically similar memories', async () => {
    const memories = [
      makeMemory({
        id: 'm1',
        content:
          'patient reports feeling depressed and hopeless about treatment outcomes and recovery timeline',
      }),
      makeMemory({
        id: 'm2',
        content:
          'client reports feeling depressed and hopeless about recovery and treatment progress',
      }),
      makeMemory({
        id: 'm3',
        content: 'enjoyed a walk in the park with friends',
      }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.crossLinks.length).toBeGreaterThanOrEqual(1)
    const link = report.crossLinks[0]
    expect(link.linkType).toBe('semantic_similarity')
    expect(link.similarity).toBeGreaterThanOrEqual(0.7)
  })

  test('detects emotional co-occurrence when valence matches', async () => {
    const memories = [
      makeMemory({
        id: 'm1',
        content:
          'feeling very happy and excited about the promotion and the new career opportunity today',
        emotionalContext: {
          valence: 0.8,
          arousal: 0.6,
          dominance: 0.7,
          primaryEmotion: 'joy',
          intensity: 0.5,
        },
      }),
      makeMemory({
        id: 'm2',
        content:
          'feeling very happy and excited about the promotion and the new career opportunity lately',
        emotionalContext: {
          valence: 0.7,
          arousal: 0.5,
          dominance: 0.6,
          primaryEmotion: 'excitement',
          intensity: 0.4,
        },
      }),
      makeMemory({
        id: 'm3',
        content:
          'a completely unrelated topic about database migrations and server configuration',
      }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    const emotionalLinks = report.crossLinks.filter(
      (l) => l.linkType === 'emotional_co_occurrence',
    )
    expect(emotionalLinks.length).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Schema extraction
// ---------------------------------------------------------------------------

describe('ConsolidationPipeline — schema extraction', () => {
  const pipeline = new ConsolidationPipeline()

  test('extracts schemas from category groups', async () => {
    const memories = [
      makeMemory({
        id: 'm1',
        content: 'first clinical note',
        category: 'clinical',
        importance: 0.7,
      }),
      makeMemory({
        id: 'm2',
        content: 'second clinical note',
        category: 'clinical',
        importance: 0.5,
      }),
      makeMemory({
        id: 'm3',
        content: 'first preference',
        category: 'preference',
        importance: 0.6,
      }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.schemas.length).toBeGreaterThanOrEqual(1)
    const clinicalSchema = report.schemas.find((s) =>
      s.title.includes('clinical'),
    )
    expect(clinicalSchema).toBeDefined()
    expect(clinicalSchema!.sourceMemoryIds).toHaveLength(2)
    expect(clinicalSchema!.confidence).toBeGreaterThan(0)
  })

  test('returns empty schemas for single-memory categories', async () => {
    const memories = [
      makeMemory({
        id: 'm1',
        content: 'only one memory here',
        category: 'lone',
      }),
      makeMemory({ id: 'm2', content: 'another category', category: 'other' }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.schemas).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Forgetting
// ---------------------------------------------------------------------------

describe('ConsolidationPipeline — forgetting', () => {
  const pipeline = new ConsolidationPipeline({
    forgettingHalfLifeDays: 1,
    archiveThreshold: 0.15,
    deleteThreshold: 0.05,
  })

  test('deletes very old low-importance memories', async () => {
    const oldDate = new Date()
    oldDate.setFullYear(oldDate.getFullYear() - 2)
    const memories = [
      makeMemory({
        id: 'm1',
        content: 'very old memory',
        importance: 0.1,
        createdAt: oldDate.toISOString(),
      }),
      makeMemory({ id: 'm2', content: 'recent memory', importance: 0.8 }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.deletedIds).toContain('m1')
    expect(report.deletedIds).not.toContain('m2')
  })

  test('archives moderately old low-importance memories', async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 7)
    const memories = [
      makeMemory({
        id: 'm1',
        content: 'week-old low importance',
        importance: 0.2,
        createdAt: oldDate.toISOString(),
      }),
      makeMemory({
        id: 'm2',
        content: 'recent high importance',
        importance: 0.9,
      }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.archivedIds).toContain('m1')
    expect(report.archivedIds).not.toContain('m2')
  })

  test('totalAfterForgetting reflects deletions only', async () => {
    const oldDate = new Date()
    oldDate.setFullYear(oldDate.getFullYear() - 2)
    const memories = [
      makeMemory({
        id: 'm1',
        content: 'old memory',
        importance: 0.1,
        createdAt: oldDate.toISOString(),
      }),
      makeMemory({ id: 'm2', content: 'recent memory', importance: 0.8 }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.totalAfterDedup).toBe(2)
    expect(report.totalAfterForgetting).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Full pipeline integration
// ---------------------------------------------------------------------------

describe('ConsolidationPipeline — integration', () => {
  test('runDedupOnly merges duplicates', async () => {
    const pipeline = new ConsolidationPipeline({ dedupThreshold: 0.92 })
    const memories = [
      makeMemory({
        id: 'm1',
        content: 'duplicate content here',
        importance: 0.4,
      }),
      makeMemory({
        id: 'm2',
        content: 'duplicate content here',
        importance: 0.7,
      }),
    ]
    const gateway = mockGateway(memories)
    const result = await pipeline.runDedupOnly(gateway, 'user_1')
    expect(result.mergedIds).toEqual(['m1'])
    expect(result.elapsedMs).toBeGreaterThan(0)
  })

  test('run() returns elapsedMs > 0', async () => {
    const pipeline = new ConsolidationPipeline()
    const memories = [makeMemory({ id: 'm1', content: 'single memory' })]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.elapsedMs).toBeGreaterThan(0)
  })

  test('run() produces correct counts end-to-end', async () => {
    const pipeline = new ConsolidationPipeline({
      dedupThreshold: 0.9,
      forgettingHalfLifeDays: 30,
      archiveThreshold: 0.2,
      deleteThreshold: 0.05,
    })
    const veryOldDate = new Date()
    veryOldDate.setFullYear(veryOldDate.getFullYear() - 5)
    const memories = [
      makeMemory({
        id: 'm1',
        content: 'unique content alpha',
        importance: 0.6,
      }),
      makeMemory({
        id: 'm2',
        content: 'duplicate text appears here in memory',
        importance: 0.4,
      }),
      makeMemory({
        id: 'm3',
        content: 'duplicate text appears here in memory',
        importance: 0.7,
      }),
      makeMemory({
        id: 'm4',
        content: 'very old unimportant',
        importance: 0.1,
        createdAt: veryOldDate.toISOString(),
      }),
    ]
    const gateway = mockGateway(memories)
    const report = await pipeline.run(gateway, 'user_1')
    expect(report.totalBefore).toBe(4)
    expect(report.totalAfterDedup).toBe(3) // m2 merged
    expect(report.totalAfterForgetting).toBe(2) // m4 deleted
    expect(report.mergedIds).toContain('m2')
    expect(report.deletedIds).toContain('m4')
  })
})
