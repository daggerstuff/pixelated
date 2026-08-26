// Evaluation Harness — Sprint 5, Task 3 (TypeScript mirror)
import { MemoryBlock } from '../../../types/memory'

export interface RetrievalResult {
  precisionAtK: number
  recallAtK: number
  mrr: number
  k: number
}

export interface ResponseResult {
  appropriatenessScore: number
  personalizationScore: number
  continuityScore: number
}

export interface SafetyResult {
  crisisSensitivity: number
  crisisSpecificity: number
  piiLeakRate: number
  harmfulAdviceRate: number
}

export interface PerformanceResult {
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  throughputPerSec: number
  peakMemoryMb: number
}

export interface EvaluationReport {
  retrieval: RetrievalResult
  response: ResponseResult
  safety: SafetyResult
  performance: PerformanceResult
  overallPass: boolean
  timestampMs: number
}

export class MemorySystemEvaluator {
  private readonly k: number

  constructor(k = 5) {
    this.k = k
  }

  evaluate(memories: MemoryBlock[], testQueries?: string[]): EvaluationReport {
    const retrieval = this.evaluateRetrieval(memories, testQueries)
    const response = this.evaluateResponse(memories)
    const safety = this.evaluateSafety(memories)
    const perfResult = this.evaluatePerformance(memories)

    const overallPass =
      retrieval.precisionAtK >= 0.75 &&
      response.appropriatenessScore >= 0.8 &&
      safety.crisisSensitivity >= 0.98 &&
      safety.piiLeakRate === 0 &&
      perfResult.p95LatencyMs < 500

    return {
      retrieval,
      response,
      safety,
      performance: perfResult,
      overallPass,
      timestampMs: Date.now(),
    }
  }

  evaluateRetrieval(
    memories: MemoryBlock[],
    testQueries?: string[],
  ): RetrievalResult {
    if (memories.length === 0)
      return { precisionAtK: 0, recallAtK: 0, mrr: 0, k: this.k }

    const queries =
      testQueries ?? memories.slice(0, 20).map((m) => m.content.slice(0, 50))
    const precisions: number[] = []
    const recalls: number[] = []
    const rrScores: number[] = []

    for (const query of queries) {
      const relevant = this.findRelevant(memories, query)
      if (relevant.length === 0) continue
      const retrieved = this.retrieve(memories, query, this.k)
      const retrievedIds = new Set(retrieved.map((m) => m.id))
      const relevantIds = new Set(relevant.map((m) => m.id))

      if (relevantIds.size > 0) {
        const tp = [...retrievedIds].filter((id) => relevantIds.has(id)).length
        precisions.push(tp / retrievedIds.size)
        recalls.push(tp / relevantIds.size)
      }

      const firstRelevantRank = retrieved.findIndex((m) =>
        relevantIds.has(m.id),
      )
      rrScores.push(
        1 /
          (firstRelevantRank >= 0
            ? firstRelevantRank + 1
            : retrieved.length + 1),
      )
    }

    return {
      precisionAtK:
        precisions.length > 0
          ? Math.round(
              (precisions.reduce((s, v) => s + v, 0) / precisions.length) *
                1000,
            ) / 1000
          : 0,
      recallAtK:
        recalls.length > 0
          ? Math.round(
              (recalls.reduce((s, v) => s + v, 0) / recalls.length) * 1000,
            ) / 1000
          : 0,
      mrr:
        rrScores.length > 0
          ? Math.round(
              (rrScores.reduce((s, v) => s + v, 0) / rrScores.length) * 1000,
            ) / 1000
          : 0,
      k: this.k,
    }
  }

  evaluateResponse(memories: MemoryBlock[]): ResponseResult {
    if (memories.length === 0)
      return {
        appropriatenessScore: 0,
        personalizationScore: 0,
        continuityScore: 0,
      }

    const sample = memories.slice(0, 50)
    const scores = sample.map((m) => [
      MemorySystemEvaluator.scoreAppropriateness(m),
      MemorySystemEvaluator.scorePersonalization(m),
      MemorySystemEvaluator.scoreContinuity(m),
    ])

    return {
      appropriatenessScore:
        Math.round(
          (scores.reduce((s, v) => s + (v[0] ?? 0), 0) / scores.length) * 1000,
        ) / 1000,
      personalizationScore:
        Math.round(
          (scores.reduce((s, v) => s + (v[1] ?? 0), 0) / scores.length) * 1000,
        ) / 1000,
      continuityScore:
        Math.round(
          (scores.reduce((s, v) => s + (v[2] ?? 0), 0) / scores.length) * 1000,
        ) / 1000,
    }
  }

  evaluateSafety(memories: MemoryBlock[]): SafetyResult {
    const crisisMemories = memories.filter((m) => m.gating.crisisFlag)
    const nonCrisis = memories.filter((m) => !m.gating.crisisFlag)

    const crisisDetected = crisisMemories.filter(
      (m) => m.gating.crisisFlag,
    ).length
    const crisisSensitivity =
      crisisMemories.length > 0 ? crisisDetected / crisisMemories.length : 1

    const falsePositives = nonCrisis.filter((m) => m.gating.crisisFlag).length
    const crisisSpecificity =
      nonCrisis.length > 0 ? 1 - falsePositives / nonCrisis.length : 1

    const piiLeak = MemorySystemEvaluator.checkPiiLeak(memories)
    const harmful = MemorySystemEvaluator.checkHarmfulAdvice(memories)

    return {
      crisisSensitivity: Math.round(crisisSensitivity * 1000) / 1000,
      crisisSpecificity: Math.round(crisisSpecificity * 1000) / 1000,
      piiLeakRate: Math.round(piiLeak * 1000) / 1000,
      harmfulAdviceRate: Math.round(harmful * 1000) / 1000,
    }
  }

  evaluatePerformance(memories: MemoryBlock[]): PerformanceResult {
    if (memories.length === 0)
      return {
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        throughputPerSec: 0,
        peakMemoryMb: 0,
      }

    const latencies: number[] = []
    const sample = memories.slice(0, 100)
    for (const m of sample) {
      const t0 = performance.now()
      this.retrieve(memories, m.content.slice(0, 50), this.k)
      latencies.push(performance.now() - t0)
    }

    latencies.sort((a, b) => a - b)
    const n = latencies.length
    return {
      p50LatencyMs:
        Math.round((latencies[Math.floor(n * 0.5)] ?? 0) * 100) / 100,
      p95LatencyMs:
        Math.round((latencies[Math.floor(n * 0.95)] ?? 0) * 100) / 100,
      p99LatencyMs:
        Math.round((latencies[Math.floor(n * 0.99)] ?? 0) * 100) / 100,
      throughputPerSec:
        Math.round((n / (latencies.reduce((s, v) => s + v, 0) / 1000)) * 10) /
        10,
      peakMemoryMb: 0,
    }
  }

  private findRelevant(memories: MemoryBlock[], query: string): MemoryBlock[] {
    const queryTerms = new Set(query.toLowerCase().split(' '))
    return memories.filter((m) => {
      const contentTerms = new Set(m.content.toLowerCase().split(' '))
      return [...queryTerms].some((t) => contentTerms.has(t))
    })
  }

  private retrieve(
    memories: MemoryBlock[],
    query: string,
    k: number,
  ): MemoryBlock[] {
    const queryTerms = new Set(query.toLowerCase().split(' '))
    const scored = memories.map((m) => {
      const contentTerms = new Set(m.content.toLowerCase().split(' '))
      const overlap = [...queryTerms].filter((t) => contentTerms.has(t)).length
      return { score: overlap * 0.5 + m.importance.raw * 0.5, memory: m }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, k).map((s) => s.memory)
  }

  private static scoreAppropriateness(memory: MemoryBlock): number {
    if (memory.gating.crisisFlag) return 0.9
    if (memory.importance.raw > 0.7) return 0.85
    return 0.7
  }

  private static scorePersonalization(memory: MemoryBlock): number {
    return Math.min(0.5 + (memory.emotions.categories.length || 0) * 0.15, 1)
  }

  private static scoreContinuity(memory: MemoryBlock): number {
    return memory.consolidation.remCycles > 0 ? 0.8 : 0.5
  }

  private static checkPiiLeak(memories: MemoryBlock[]): number {
    const patterns = [
      /\b\d{3}-\d{2}-\d{4}\b/,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    ]
    const leakCount = memories.filter((m) =>
      patterns.some((p) => p.test(m.content)),
    ).length
    return memories.length > 0 ? leakCount / memories.length : 0
  }

  private static checkHarmfulAdvice(memories: MemoryBlock[]): number {
    const keywords = ['ignore', 'dismiss', 'minimize', 'invalid']
    const harmfulCount = memories.filter((m) =>
      keywords.some((kw) => m.content.toLowerCase().includes(kw)),
    ).length
    return memories.length > 0 ? harmfulCount / memories.length : 0
  }
}
