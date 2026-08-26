// Memory Inventory System — Sprint 3, Task 1 (TypeScript mirror)
import { MemoryBlock, ConsolidationPhase } from '../../../types/memory'

export interface InventoryGroup {
  key: string
  memories: MemoryBlock[]
  totalImportance: number
  avgValence: number
  count: number
}

export interface MemoryCatalog {
  allMemories: MemoryBlock[]
  byImportance: MemoryBlock[]
  bySession: Record<string, InventoryGroup>
  byTopic: Record<string, InventoryGroup>
  byValence: Record<string, InventoryGroup>
  buildTimeMs: number
  totalCount: number
  totalImportance: number
}

export class MemoryInventory {
  private memories: MemoryBlock[] = []
  private readonly tenantIds: Set<string> = new Set()

  addMemory(memory: MemoryBlock): void {
    this.memories.push(memory)
    this.tenantIds.add(memory.tenantId)
  }

  addMemories(memories: MemoryBlock[]): void {
    for (const m of memories) {
      this.addMemory(m)
    }
  }

  clear(): void {
    this.memories = []
    this.tenantIds.clear()
  }

  buildCatalog(): MemoryCatalog {
    const t0 = performance.now()

    const byImportance = [...this.memories].sort(
      (a, b) => b.importance.raw - a.importance.raw,
    )
    const bySession = this.groupBySession()
    const byTopic = this.groupByTopic()
    const byValence = this.groupByValence()

    const buildTimeMs = performance.now() - t0
    const totalImportance = this.memories.reduce(
      (sum, m) => sum + m.importance.raw,
      0,
    )

    return {
      allMemories: [...this.memories],
      byImportance,
      bySession,
      byTopic,
      byValence,
      buildTimeMs: Math.round(buildTimeMs * 100) / 100,
      totalCount: this.memories.length,
      totalImportance: Math.round(totalImportance * 1e6) / 1e6,
    }
  }

  getTenantMemories(tenantId: string): MemoryBlock[] {
    return this.memories.filter((m) => m.tenantId === tenantId)
  }

  getSessionMemories(sessionId: string): MemoryBlock[] {
    return this.memories.filter((m) => m.sessionId === sessionId)
  }

  getCrisisMemories(): MemoryBlock[] {
    return this.memories.filter((m) => m.gating.crisisFlag)
  }

  getPhaseMemories(phase: ConsolidationPhase): MemoryBlock[] {
    return this.memories.filter((m) => m.consolidation.phase === phase)
  }

  private groupBySession(): Record<string, InventoryGroup> {
    const groups: Record<string, MemoryBlock[]> = {}
    for (const m of this.memories) {
      ;(groups[m.sessionId] ??= []).push(m)
    }
    return Object.fromEntries(
      Object.entries(groups).map(([key, memories]) => [
        key,
        this.makeGroup(key, memories),
      ]),
    )
  }

  private groupByTopic(): Record<string, InventoryGroup> {
    const groups: Record<string, MemoryBlock[]> = {}
    for (const m of this.memories) {
      const categories =
        m.emotions.categories.length > 0
          ? m.emotions.categories
          : ['uncategorized']
      for (const cat of categories) {
        ;(groups[cat] ??= []).push(m)
      }
    }
    return Object.fromEntries(
      Object.entries(groups).map(([key, memories]) => [
        key,
        this.makeGroup(key, memories),
      ]),
    )
  }

  private groupByValence(): Record<string, InventoryGroup> {
    const buckets: Record<string, MemoryBlock[]> = {
      negative: [],
      neutral: [],
      positive: [],
    }
    for (const m of this.memories) {
      if (m.emotions.valence < -0.2) buckets['negative'].push(m)
      else if (m.emotions.valence > 0.2) buckets['positive'].push(m)
      else buckets['neutral'].push(m)
    }
    return Object.fromEntries(
      Object.entries(buckets)
        .filter(([, memories]) => memories.length > 0)
        .map(([key, memories]) => [key, this.makeGroup(key, memories)]),
    )
  }

  private makeGroup(key: string, memories: MemoryBlock[]): InventoryGroup {
    const totalImportance = memories.reduce((s, m) => s + m.importance.raw, 0)
    const avgValence =
      memories.length > 0
        ? memories.reduce((s, m) => s + m.emotions.valence, 0) / memories.length
        : 0
    return {
      key,
      memories,
      totalImportance: Math.round(totalImportance * 1e6) / 1e6,
      avgValence: Math.round(avgValence * 1e4) / 1e4,
      count: memories.length,
    }
  }

  get count(): number {
    return this.memories.length
  }

  get tenantIdsList(): string[] {
    return [...this.tenantIds]
  }
}
