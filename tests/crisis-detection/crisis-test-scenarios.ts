/**
 * Type declarations for crisis-test-scenarios module
 */

export interface CrisisTestSession {
  sessionId: string
  conversationHistory: Array<{ role: string; content: string }>
  metadata?: Record<string, unknown>
  timestamp?: Date
  [key: string]: unknown
}

export interface CrisisTestCase {
  id: string
  text: string
  type: 'suicidal_ideation' | 'self_harm' | 'panic_attack' | 'substance_abuse' | 'psychotic_symptoms' | 'non_crisis'
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical'
  keywords: string[]
  crisisType?: string
  session: CrisisTestSession
}

export interface CrisisGroundTruthLabel {
  crisisType: string
  severity: string
  escalationLevel: 'none' | 'warning' | 'escalation' | 'emergency'
  expectedScore?: number
}

export interface CrisisTestDatasetStats {
  total: number
  crisisCases: number
  nonCrisisCases: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  totalCases: number
}

// Use Map to match test expectations (.has() and .get() methods)
export const ALL_CRISIS_TEST_CASES: CrisisTestCase[] = []
export const CRISIS_GROUND_TRUTH_LABELS = new Map<string, CrisisGroundTruthLabel>()
export const CRISIS_TEST_DATASET_STATS: CrisisTestDatasetStats = {
  total: 0,
  crisisCases: 0,
  nonCrisisCases: 0,
  byType: {},
  bySeverity: {},
  totalCases: 0
}
export const SUICIDAL_IDEATION_TESTS: CrisisTestCase[] = []
export const SELF_HARM_TESTS: CrisisTestCase[] = []
export const PANIC_ATTACK_TESTS: CrisisTestCase[] = []
export const SUBSTANCE_ABUSE_TESTS: CrisisTestCase[] = []
export const PSYCHOTIC_SYMPTOMS_TESTS: CrisisTestCase[] = []
export const NON_CRISIS_TESTS: CrisisTestCase[] = []