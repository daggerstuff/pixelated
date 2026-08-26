// Semantic Deduplication Engine — Sprint 3, Task 2 (TypeScript mirror)
import { MemoryBlock } from '../../../types/memory'

const DEDUP_THRESHOLD = 0.92

export interface DedupCluster {
  clusterId: string
  members: MemoryBlock[]
  representative: MemoryBlock
  similarityScores: number[]
  provenance: string[]
}

export interface DedupResult {
  clusters: DedupCluster[]
  uniqueMemories: MemoryBlock[]
  mergedMemories: MemoryBlock[]
  totalBefore: number
  totalAfter: number
  reductionPct: number
  elapsedMs: number
}

export class SemanticDeduplicator {
  private readonly threshold: number
  private idf: Map<string, number> = new Map()

  constructor(threshold = DEDUP_THRESHOLD) {
    this.threshold = threshold
  }

  deduplicate(memories: MemoryBlock[]): DedupResult {
    const t0 = performance.now()
    if (memories.length < 2) {
      return {
        clusters: [],
        uniqueMemories: [...memories],
        mergedMemories: [],
        totalBefore: memories.length,
        totalAfter: memories.length,
        reductionPct: 0,
        elapsedMs: 0,
      }
    }

    this.buildIndex(memories)
    const vectors = memories.map((m) => this.tfidfVector(m.content))

    const used = new Set<number>()
    const clusters: DedupCluster[] = []
    const unique: MemoryBlock[] = []

    for (let i = 0; i < memories.length; i++) {
      if (used.has(i)) continue
      const clusterMembers: MemoryBlock[] = [memories[i]]
      const clusterScores = [1.0]
      used.add(i)

      for (let j = i + 1; j < memories.length; j++) {
        if (used.has(j)) continue
        const sim = this.cosine(vectors[i], vectors[j])
        if (sim >= this.threshold) {
          clusterMembers.push(memories[j])
          clusterScores.push(sim)
          used.add(j)
        }
      }

      if (clusterMembers.length > 1) {
        const rep: MemoryBlock = clusterMembers.reduce(
          (a: MemoryBlock, b: MemoryBlock) =>
            b.importance.raw > a.importance.raw ? b : a,
          clusterMembers[0],
        )
        const cluster: DedupCluster = {
          clusterId: `cluster_${clusters.length}`,
          members: clusterMembers,
          representative: rep,
          similarityScores: clusterScores,
          provenance: clusterMembers.map((m) => m.id),
        }
        clusters.push(cluster)
        unique.push(this.mergeCluster(cluster))
      } else {
        unique.push(memories[i])
      }
    }

    const elapsedMs = performance.now() - t0
    const merged = clusters.flatMap((c) => c.members.slice(1))
    const reductionPct =
      ((memories.length - unique.length) / memories.length) * 100

    return {
      clusters,
      uniqueMemories: unique,
      mergedMemories: merged,
      totalBefore: memories.length,
      totalAfter: unique.length,
      reductionPct: Math.round(reductionPct * 100) / 100,
      elapsedMs: Math.round(elapsedMs * 100) / 100,
    }
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().match(/[a-z]+/g) ?? []
  }

  buildIndex(memories: MemoryBlock[]): void {
    const docFreq = new Map<string, number>()
    const allTerms = new Set<string>()
    for (const m of memories) {
      const terms = new Set(this.tokenize(m.content))
      for (const t of terms) allTerms.add(t)
      for (const t of terms) {
        docFreq.set(t, (docFreq.get(t) ?? 0) + 1)
      }
    }
    const n = memories.length
    this.idf = new Map()
    for (const [term, df] of docFreq) {
      this.idf.set(term, Math.log((n + 1) / (df + 1)) + 1)
    }
  }

  tfidfVector(text: string): Map<string, number> {
    const terms = this.tokenize(text)
    if (terms.length === 0) return new Map()
    const tf = new Map<string, number>()
    for (const t of terms) {
      tf.set(t, (tf.get(t) ?? 0) + 1)
    }
    const maxTf = Math.max(...tf.values())
    const vector = new Map<string, number>()
    for (const [t, count] of tf) {
      vector.set(t, (count / maxTf) * (this.idf.get(t) ?? 1.0))
    }
    return vector
  }

  cosine(a: Map<string, number>, b: Map<string, number>): number {
    if (a.size === 0 || b.size === 0) return 0
    let dot = 0
    let normA = 0
    let normB = 0
    for (const [t, v] of a) {
      normA += v * v
      if (b.has(t)) dot += v * b.get(t)!
    }
    for (const [, v] of b) normB += v * v
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  private mergeCluster(cluster: DedupCluster): MemoryBlock {
    const rep = { ...cluster.representative }
    const maxArousal = Math.max(
      ...cluster.members.map((m) => m.emotions.arousal),
    )
    const maxEmotional = Math.max(
      ...cluster.members.map((m) => m.importance.emotionalWeight),
    )
    const allIndicators = [
      ...new Set(cluster.members.flatMap((m) => m.gating.traumaIndicators)),
    ]
    const maxRemCycles = Math.max(
      ...cluster.members.map((m) => m.consolidation.remCycles),
    )

    return {
      ...rep,
      emotions: { ...rep.emotions, arousal: maxArousal },
      importance: { ...rep.importance, emotionalWeight: maxEmotional },
      gating: { ...rep.gating, traumaIndicators: allIndicators },
      consolidation: { ...rep.consolidation, remCycles: maxRemCycles },
    }
  }
}
