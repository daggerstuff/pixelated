// ---- Analytics Types for Sprint 3 Modules ----

// Module 1: Clinical Competency
export interface StateVelocityDataPoint {
  state: string
  medianTimeSeconds: number
  cohort?: string
}

export interface InterventionRate {
  totalTurns: number
  inputGuardTriggers: number
  rate: number // percentage
}

export interface DeEscalationDataPoint {
  scenario: string
  successRate: number // percentage
  attempts: number
}

export interface OSCEScoreRow {
  learnerName: string
  infoExtractionRate: number // percentage
  communicationScore: number // 1-100
  totalTurns: number
  criticalItemsFound: number
  criticalItemsTotal: number
}

export interface CompetencyData {
  stateVelocities: StateVelocityDataPoint[]
  interventionRate: InterventionRate
  deEscalationEfficacy: DeEscalationDataPoint[]
  osceScores: OSCEScoreRow[]
}

// Module 2: Institutional Consumption
export interface BurnRateData {
  hoursConsumed: number
  hoursAllocated: number
  periodStart: string
  periodEnd: string
}

export interface SeatActivationData {
  licensesProvisioned: number
  activeMonthlyUsers: number
  peakConcurrent: number
  utilizationRate: number // percentage
}

export interface TokenExpenditureCategory {
  category: string
  tokens: number
  cost?: number
}

export interface ConsumptionData {
  burnRate: BurnRateData
  seatActivation: SeatActivationData
  tokenExpenditure: TokenExpenditureCategory[]
}

// Module 3: Compliance & System Integrity
export interface PHIInterceptionData {
  totalIntercepted: number
  byPattern: { pattern: string; count: number }[]
  trend: 'increasing' | 'stable' | 'decreasing'
}

export interface AuditChainStatus {
  chainValid: boolean
  lastVerifiedAt: string
  totalEntries: number
}

export interface InferenceLatencyPoint {
  timestamp: string
  avgMs: number
  p95Ms: number
}

export interface ComplianceData {
  phiInterceptions: PHIInterceptionData
  auditChain: AuditChainStatus
  inferenceLatency: InferenceLatencyPoint[]
}
