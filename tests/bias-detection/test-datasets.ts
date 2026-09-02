/**
 * Type declarations for test-datasets module
 */

import type {
  TherapeuticSession,
  ParticipantDemographics,
  TrainingScenario,
  SessionContent,
} from '../../apps/web/src/lib/ai/bias-detection/types'

export type {
  TherapeuticSession,
  ParticipantDemographics,
  TrainingScenario,
  SessionContent,
}

export interface BiasTestCase {
  id: string
  text: string
  category:
    | 'gender'
    | 'racial'
    | 'cultural'
    | 'age'
    | 'disability'
    | 'socioeconomic'
  expectedBiasScore: number
  expectedSeverity: 'none' | 'low' | 'medium' | 'high' | 'critical'
  keywords: string[]
  session: TherapeuticSession
}

export interface GroundTruthLabel {
  biasScore: number
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical'
  category: string
  hasBias: boolean
  notes?: string
}

export interface TestDatasetStats {
  total: number
  biasedCases: number
  neutralCases: number
  byCategory: Record<string, number>
  bySeverity: Record<string, number>
}

export const ALL_BIAS_TEST_CASES: BiasTestCase[] = []
export const GROUND_TRUTH_LABELS: Record<string, GroundTruthLabel> = {}
export const TEST_DATASET_STATS: TestDatasetStats = {
  total: 0,
  biasedCases: 0,
  neutralCases: 0,
  byCategory: {},
  bySeverity: {},
}
export const GENDER_BIAS_TESTS: BiasTestCase[] = []
export const RACIAL_BIAS_TESTS: BiasTestCase[] = []
export const CULTURAL_BIAS_TESTS: BiasTestCase[] = []
export const AGE_BIAS_TESTS: BiasTestCase[] = []
export const DISABILITY_BIAS_TESTS: BiasTestCase[] = []
export const SOCIOECONOMIC_BIAS_TESTS: BiasTestCase[] = []
