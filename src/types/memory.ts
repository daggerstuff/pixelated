/**
 * PIX-510: Sprint 1 - Memory Schema & Unification
 * Canonical memory block schema for therapeutic AI system.
 *
 * TypeScript/Python parity required — see ai/memory/schema.py for Python mirror.
 * JSON Schema validation: ai/memory/schema.json
 */

export type PIIStatus = 'absent' | 'redacted' | 'present'
export type ConsentGate = 'open' | 'restricted' | 'blocked'
export type ReveriePhase =
  'dormant' | 'seeded' | 'surfacing' | 'active' | 'fading'
export type ConsolidationPhase =
  | 'raw'
  | 'consolidated'
  | 'archived'
  | 'latent' // Reverie Engine: memories that surface as subconscious influences
  | 'forgotten'

/** Importance scoring breakdown */
export interface MemoryImportance {
  raw: number // Computed composite score [0, 1]
  recency: number // Exponential decay factor [0, 1], τ = 7 days
  relevance: number // Query-context cosine similarity [0, 1]
  emotionalWeight: number // Crisis multiplier (1.0–5.0x)
  actionability: number // Goal-relevance score [0, 1]
  reveriePotential: number // Reverie Engine: [0,1] likelihood of surfacing as subconscious influence
}

/** Emotional tagging from Plutchik wheel + VAD */
export interface MemoryEmotions {
  valence: number // -1.0 (negative) to 1.0 (positive)
  arousal: number // 0.0 (calm) to 1.0 (intense)
  categories: string[] // e.g. ["anxiety", "hope", "grief"]
}

/** Safety and consent gating metadata */
export interface MemoryGating {
  piiStatus: PIIStatus
  crisisFlag: boolean
  traumaIndicators: string[]
  consentGate: ConsentGate
}

/** Memory consolidation / lifecycle state */
export interface MemoryConsolidation {
  phase: ConsolidationPhase
  lastProcessed: number // Unix timestamp ms
  remCycles: number // Remaining consolidation cycles
  schemaReferences: string[] // Pointers to prior schema versions
  reverieEligible: boolean // Reverie Engine: can this memory surface as a reverie?
  reveriePhase: ReveriePhase
}

/** Canonical memory block — all fields required for tenant isolation and safety */
export interface MemoryBlock {
  id: string
  tenantId: string
  sessionId: string
  content: string
  timestamp: number // Unix timestamp ms

  importance: MemoryImportance
  emotions: MemoryEmotions
  gating: MemoryGating
  consolidation: MemoryConsolidation
}

/** Lightweight memory reference for search results / listings */
export interface MemoryRef {
  'id': string
  'tenantId': string
  'sessionId': string
  'content': string // Truncated / redacted
  'timestamp': number
  'importance.raw': number
  'emotions.valence': number
  'gating.crisisFlag': boolean
}

/** Search / query filter params */
export interface MemorySearchFilters {
  tenantId: string
  sessionId?: string
  minImportance?: number
  maxImportance?: number
  emotions?: string[]
  crisisOnly?: boolean
  dateFrom?: number
  dateTo?: number
  consolidationPhases?: ConsolidationPhase[]
  limit?: number
  offset?: number
}

/** Memory write input (id/server-generated if omitted) */
export interface MemoryWriteInput {
  tenantId: string
  sessionId: string
  content: string
  emotions?: Partial<MemoryEmotions>
  gating?: Partial<MemoryGating>
}

/** Importance scoring weights (configurable via env) */
export interface ScoringWeights {
  alpha: number // recency weight (default 0.25)
  beta: number // relevance weight (default 0.25)
  gamma: number // emotional weight (default 0.30)
  delta: number // actionability weight (default 0.20)
  decayTauDays: number // exponential decay time constant (default 7)
}
