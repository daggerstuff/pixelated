/**
 * PIX-510 Task 2: Importance Scoring Engine — TypeScript mirror
 * Mirrors ai/memory/importance_scorer.py exactly.
 *
 * Scoring formula: importance = α·recency + β·relevance + γ·(emotionalWeight/5.0) + δ·actionability
 * All weights configurable via ScoringWeights env vars.
 */

import type { MemoryBlock, ScoringWeights } from '@/types/memory'

// ─── Cosine similarity ────────────────────────────────────────────────────────

function tokenise(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/\b\w+\b/g) ?? [])
}

export function cosineSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const tokensA = tokenise(a)
  const tokensB = tokenise(b)
  if (!tokensA.size || !tokensB.size) return 0

  let intersection = 0
  for (const tok of tokensA) {
    if (tokensB.has(tok)) intersection++
  }

  const normA = Math.sqrt(tokensA.size)
  const normB = Math.sqrt(tokensB.size)
  return intersection / (normA * normB)
}

// ─── Exponential decay ────────────────────────────────────────────────────────

/** e^(-age / τ) where τ is the decay time constant in days (default 7). */
export function exponentialDecay(
  timestampMs: number,
  nowMs: number = Date.now(),
  tauDays = 7,
): number {
  const ageMs = Math.max(0, nowMs - timestampMs)
  const tauMs = tauDays * 86_400_000
  return Math.exp(-ageMs / tauMs)
}

// ─── Emotional weight multipliers ─────────────────────────────────────────────

const CRISIS_CATEGORIES = new Set([
  'suicide',
  'self-harm',
  'overdose',
  'panic',
  'psychosis',
])
const HIGH_CATEGORIES = new Set([
  'grief',
  'trauma',
  'anxiety',
  'fear',
  'anger',
  'despair',
  'hopelessness',
  'sadness',
])

export function emotionalWeight(categories: string[]): number {
  const lower = categories.map((c) => c.toLowerCase())
  if (lower.some((c) => CRISIS_CATEGORIES.has(c))) return 5.0
  if (lower.some((c) => HIGH_CATEGORIES.has(c))) return 2.0
  return 1.0
}

// ─── Score weights (configurable) ─────────────────────────────────────────────

export const DEFAULT_WEIGHTS: ScoringWeights = {
  alpha: 0.25,
  beta: 0.25,
  gamma: 0.3,
  delta: 0.2,
  decayTauDays: 7,
}

function loadWeightsFromEnv(): ScoringWeights {
  const e = (key: string, fallback: number) => {
    const v = process.env[key]
    return v !== undefined ? parseFloat(v) : fallback
  }
  return {
    alpha: e('MEMORY_SCORE_ALPHA', 0.25),
    beta: e('MEMORY_SCORE_BETA', 0.25),
    gamma: e('MEMORY_SCORE_GAMMA', 0.3),
    delta: e('MEMORY_SCORE_DELTA', 0.2),
    decayTauDays: e('MEMORY_DECAY_TAU_DAYS', 7),
  }
}

// ─── Main scorer ───────────────────────────────────────────────────────────────

export class ImportanceScorer {
  private readonly weights: ScoringWeights

  constructor(weights: ScoringWeights = DEFAULT_WEIGHTS) {
    this.weights = weights
  }

  static fromEnv(): ImportanceScorer {
    return new ImportanceScorer(loadWeightsFromEnv())
  }

  /** Composite importance score [0, 1]. Deterministic — same input → same output. */
  score(memory: MemoryBlock, context = ''): number {
    const recency = exponentialDecay(
      memory.timestamp,
      undefined,
      this.weights.decayTauDays,
    )
    const relevance = context ? cosineSimilarity(memory.content, context) : 0.5
    const emotional = emotionalWeight(memory.emotions.categories)
    const actionability = memory.importance.actionability

    return this.weightsCompute(recency, relevance, emotional, actionability)
  }

  /** Individual components for debugging / inspection. */
  scoreComponents(
    memory: MemoryBlock,
    context = '',
  ): {
    recency: number
    relevance: number
    emotionalWeight: number
    actionability: number
    raw: number
  } {
    const recency = exponentialDecay(
      memory.timestamp,
      undefined,
      this.weights.decayTauDays,
    )
    const relevance = context ? cosineSimilarity(memory.content, context) : 0.5
    const emotional = emotionalWeight(memory.emotions.categories)
    const actionability = memory.importance.actionability
    const raw = this.weightsCompute(
      recency,
      relevance,
      emotional,
      actionability,
    )

    return {
      recency: Math.round(recency * 1e6) / 1e6,
      relevance: Math.round(relevance * 1e6) / 1e6,
      emotionalWeight: Math.round(emotional * 100) / 100,
      actionability: Math.round(actionability * 1e6) / 1e6,
      raw: Math.round(raw * 1e6) / 1e6,
    }
  }

  /** Benchmark: average ms per score over n iterations. */
  benchmark(n = 1000): number {
    const memory: MemoryBlock = {
      id: 'bench',
      tenantId: 'bench',
      sessionId: 'bench',
      content:
        'Therapeutic session discussing coping strategies for anxiety and depression',
      timestamp: Date.now(),
      importance: {
        raw: 0,
        recency: 0,
        relevance: 0,
        emotionalWeight: 1,
        actionability: 0.5,
        reveriePotential: 0,
      },
      emotions: { valence: -0.3, arousal: 0.7, categories: ['anxiety'] },
      gating: {
        piiStatus: 'absent',
        crisisFlag: false,
        traumaIndicators: [],
        consentGate: 'open',
      },
      consolidation: {
        phase: 'raw',
        lastProcessed: 0,
        remCycles: 0,
        schemaReferences: [],
        reverieEligible: false,
        reveriePhase: 'dormant',
      },
    }

    const start = performance.now()
    for (let i = 0; i < n; i++) {
      this.score(memory)
    }
    const elapsed = performance.now() - start
    return elapsed / n // ms per score
  }

  // ── internal ──────────────────────────────────────────────────────────────

  private weightsCompute(
    recency: number,
    relevance: number,
    emotionalWeight: number,
    actionability: number,
  ): number {
    const { alpha, beta, gamma, delta } = this.weights
    const raw =
      alpha * recency +
      beta * relevance +
      gamma * (emotionalWeight / 5.0) +
      delta * actionability
    return Math.round(Math.min(raw, 1.0) * 1e6) / 1e6
  }
}
