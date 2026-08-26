import { MemoryBlock } from '../../../types/memory'
import { MemoryInventory } from './memory-inventory'

function makeMemory(overrides: Partial<MemoryBlock> = {}): MemoryBlock {
  return {
    id: overrides.id ?? `mem_${Math.random().toString(36).slice(2, 10)}`,
    tenantId: overrides.tenantId ?? 'tenant_1',
    sessionId: overrides.sessionId ?? 'sess_1',
    content: overrides.content ?? 'test memory content',
    timestamp: overrides.timestamp ?? Date.now(),
    importance: overrides.importance ?? {
      raw: 0.5,
      recency: 0.8,
      relevance: 0.6,
      emotionalWeight: 1.0,
      actionability: 0.4,
      reveriePotential: 0.1,
    },
    emotions: overrides.emotions ?? {
      valence: 0.0,
      arousal: 0.5,
      categories: [],
    },
    gating: overrides.gating ?? {
      piiStatus: 'absent',
      crisisFlag: false,
      traumaIndicators: [],
      consentGate: 'open',
    },
    consolidation: overrides.consolidation ?? {
      phase: 'raw',
      lastProcessed: 0,
      remCycles: 3,
      schemaReferences: [],
      reverieEligible: false,
      reveriePhase: 'dormant',
    },
  }
}

describe('MemoryInventory', () => {
  let inventory: MemoryInventory

  beforeEach(() => {
    inventory = new MemoryInventory()
  })

  test('add and count memories', () => {
    expect(inventory.count).toBe(0)
    inventory.addMemory(makeMemory())
    expect(inventory.count).toBe(1)
    inventory.addMemories([makeMemory(), makeMemory()])
    expect(inventory.count).toBe(3)
  })

  test('build catalog sorts by importance', () => {
    inventory.addMemory(
      makeMemory({
        id: 'low',
        importance: {
          raw: 0.2,
          recency: 0,
          relevance: 0,
          emotionalWeight: 1,
          actionability: 0,
          reveriePotential: 0.1,
        },
      }),
    )
    inventory.addMemory(
      makeMemory({
        id: 'high',
        importance: {
          raw: 0.9,
          recency: 0,
          relevance: 0,
          emotionalWeight: 1,
          actionability: 0,
          reveriePotential: 0.1,
        },
      }),
    )
    inventory.addMemory(
      makeMemory({
        id: 'mid',
        importance: {
          raw: 0.5,
          recency: 0,
          relevance: 0,
          emotionalWeight: 1,
          actionability: 0,
          reveriePotential: 0.1,
        },
      }),
    )

    const catalog = inventory.buildCatalog()
    expect(catalog.byImportance[0].id).toBe('high')
    expect(catalog.byImportance[1].id).toBe('mid')
    expect(catalog.byImportance[2].id).toBe('low')
  })

  test('groups by session', () => {
    inventory.addMemory(makeMemory({ sessionId: 'sess_a' }))
    inventory.addMemory(makeMemory({ sessionId: 'sess_a' }))
    inventory.addMemory(makeMemory({ sessionId: 'sess_b' }))

    const catalog = inventory.buildCatalog()
    expect(catalog.bySession['sess_a'].count).toBe(2)
    expect(catalog.bySession['sess_b'].count).toBe(1)
  })

  test('groups by valence', () => {
    inventory.addMemory(
      makeMemory({ emotions: { valence: -0.5, arousal: 0.5, categories: [] } }),
    )
    inventory.addMemory(
      makeMemory({ emotions: { valence: 0.0, arousal: 0.5, categories: [] } }),
    )
    inventory.addMemory(
      makeMemory({ emotions: { valence: 0.5, arousal: 0.5, categories: [] } }),
    )

    const catalog = inventory.buildCatalog()
    expect(catalog.byValence['negative'].count).toBe(1)
    expect(catalog.byValence['neutral'].count).toBe(1)
    expect(catalog.byValence['positive'].count).toBe(1)
  })

  test('tenant isolation', () => {
    inventory.addMemory(makeMemory({ tenantId: 'tenant_a' }))
    inventory.addMemory(makeMemory({ tenantId: 'tenant_b' }))

    expect(inventory.getTenantMemories('tenant_a').length).toBe(1)
    expect(inventory.getTenantMemories('tenant_b').length).toBe(1)
  })

  test('crisis filtering', () => {
    inventory.addMemory(
      makeMemory({
        gating: {
          crisisFlag: true,
          piiStatus: 'absent',
          traumaIndicators: [],
          consentGate: 'open',
        },
      }),
    )
    inventory.addMemory(makeMemory())

    expect(inventory.getCrisisMemories().length).toBe(1)
  })

  test('clear removes all', () => {
    inventory.addMemories([makeMemory(), makeMemory()])
    inventory.clear()
    expect(inventory.count).toBe(0)
  })
})
