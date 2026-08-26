// Dataset Preparation — Sprint 5, Task 1 (TypeScript mirror)
import { MemoryBlock } from '../../../types/memory'

export interface TrainingExample {
  query: string
  context: string
  response: string
  metadata: Record<string, unknown>
}

export interface DatasetSplit {
  train: TrainingExample[]
  val: TrainingExample[]
  test: TrainingExample[]
}

export interface DatasetStats {
  totalExamples: number
  trainCount: number
  valCount: number
  testCount: number
  avgValence: number
  crisisRatio: number
  piiLeakDetected: boolean
}

const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
]

export class DatasetPreparator {
  private readonly trainRatio: number
  private readonly valRatio: number
  private readonly seed: number
  private prngState: number

  constructor(trainRatio = 0.7, valRatio = 0.15, seed = 42) {
    this.trainRatio = trainRatio
    this.valRatio = valRatio
    this.seed = seed
    this.prngState = seed
  }

  private nextRandom(): number {
    let t = (this.prngState += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  private shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.nextRandom() * (i + 1))
      const tmp = result[i]
      result[i] = result[j]!
      result[j] = tmp
    }
    return result
  }

  prepare(memories: MemoryBlock[]): [DatasetSplit, DatasetStats] {
    this.prngState = this.seed
    const examples = this.extractExamples(memories)
    const balanced = this.balanceValence(examples)
    const piiLeak = this.checkPii(balanced)
    const split = this.split(balanced)
    const stats = this.computeStats(split, piiLeak)
    return [split, stats]
  }

  private extractExamples(memories: MemoryBlock[]): TrainingExample[] {
    const sessionGroups: Record<string, MemoryBlock[]> = {}
    for (const m of [...memories].sort((a, b) => a.timestamp - b.timestamp)) {
      ;(sessionGroups[m.sessionId] ??= []).push(m)
    }

    const examples: TrainingExample[] = []
    for (const [sessionId, sessionMemories] of Object.entries(sessionGroups)) {
      for (let i = 0; i < sessionMemories.length; i++) {
        const memory = sessionMemories[i]
        const priorContext = sessionMemories
          .slice(0, i)
          .map((m) => m.content)
          .join('\n')
        examples.push({
          query: memory.content,
          context: priorContext,
          response: DatasetPreparator.generateResponseTemplate(memory),
          metadata: {
            session_id: sessionId,
            memory_id: memory.id,
            valence: memory.emotions.valence,
            arousal: memory.emotions.arousal,
            crisis_flag: memory.gating.crisisFlag,
            consolidation_phase: memory.consolidation.phase,
          },
        })
      }
    }
    return examples
  }

  private balanceValence(examples: TrainingExample[]): TrainingExample[] {
    const buckets: Record<string, TrainingExample[]> = {
      negative: [],
      neutral: [],
      positive: [],
    }
    for (const ex of examples) {
      const v = (ex.metadata['valence'] as number) ?? 0
      if (v < -0.2) buckets['negative'].push(ex)
      else if (v > 0.2) buckets['positive'].push(ex)
      else buckets['neutral'].push(ex)
    }

    const maxSize = Math.max(...Object.values(buckets).map((b) => b.length), 1)
    const balanced: TrainingExample[] = []
    for (const bucket of Object.values(buckets)) {
      if (bucket.length === 0) continue
      if (bucket.length >= maxSize) {
        balanced.push(...bucket.slice(0, maxSize))
      } else {
        balanced.push(...bucket)
        const repeats = Array.from(
          { length: Math.ceil(maxSize / bucket.length) },
          () => bucket,
        ).flat()
        balanced.push(...repeats.slice(0, maxSize - bucket.length))
      }
    }
    return this.shuffle(balanced)
  }

  private checkPii(examples: TrainingExample[]): boolean {
    for (const ex of examples) {
      for (const pattern of PII_PATTERNS) {
        if (pattern.test(ex.query) || pattern.test(ex.response)) return true
      }
    }
    return false
  }

  private split(examples: TrainingExample[]): DatasetSplit {
    const shuffled = this.shuffle(examples)
    const n = shuffled.length
    const trainEnd = Math.floor(n * this.trainRatio)
    const valEnd = trainEnd + Math.floor(n * this.valRatio)
    return {
      train: shuffled.slice(0, trainEnd),
      val: shuffled.slice(trainEnd, valEnd),
      test: shuffled.slice(valEnd),
    }
  }

  private computeStats(split: DatasetSplit, piiLeak: boolean): DatasetStats {
    const all = [...split.train, ...split.val, ...split.test]
    const valences = all.map((ex) => (ex.metadata['valence'] as number) ?? 0)
    const crisisCount = all.filter((ex) => ex.metadata['crisis_flag']).length
    return {
      totalExamples: all.length,
      trainCount: split.train.length,
      valCount: split.val.length,
      testCount: split.test.length,
      avgValence:
        valences.length > 0
          ? Math.round(
              (valences.reduce((s, v) => s + v, 0) / valences.length) * 1000,
            ) / 1000
          : 0,
      crisisRatio:
        all.length > 0
          ? Math.round((crisisCount / all.length) * 1000) / 1000
          : 0,
      piiLeakDetected: piiLeak,
    }
  }

  private static generateResponseTemplate(memory: MemoryBlock): string {
    const emotionLabels =
      memory.emotions.categories.length > 0
        ? memory.emotions.categories.join(', ')
        : 'general'
    const valenceDesc =
      memory.emotions.valence < -0.2
        ? 'negative emotional state'
        : memory.emotions.valence > 0.2
          ? 'positive emotional state'
          : 'neutral emotional state'
    return `Client is in a ${valenceDesc} (${emotionLabels}). Content: ${memory.content}. Importance: ${memory.importance.raw.toFixed(2)}. Continue therapeutic engagement with appropriate emotional attunement.`
  }
}
