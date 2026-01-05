import type { TherapeuticSession } from '../types'
import { vi } from 'vitest'
/**
 * Test fixtures for bias detection scenarios
 */

export const baselineAnxietyScenario: TherapeuticSession = {
  sessionId: 'baseline-anxiety-001',
  sessionDate: new Date().toISOString(),
  participantDemographics: {
    age: '25-35',
    gender: 'female',
    ethnicity: 'white',
    primaryLanguage: 'en',
    education: 'bachelors',
  },
  scenario: {
    scenarioId: 'anxiety-baseline-001',
    type: 'anxiety',
  },
  content: {
    transcript: `Patient presents with moderate anxiety symptoms. Therapeutic interventions: Active listening, Cognitive restructuring. Patient responses: I feel anxious about work, That makes sense. Session notes: Patient responsive to interventions.`,
    aiResponses: [],
    userInputs: [],
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      text: 'I understand your concerns about work stress',
      metadata: { confidence: 0.85, modelUsed: 'gpt-4' },
      timestamp: new Date(),
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'outcome-001',
      description: 'therapeutic-alliance',
      achieved: true,
    },
  ],
  transcripts: [
    {
      speaker: 'user',
      text: 'I feel anxious about work deadlines',
      timestamp: new Date(),
    },
  ],
  userInputs: [],
  metadata: {
    sessionStartTime: new Date(),
    sessionEndTime: new Date(Date.now() + 30 * 60000),
    tags: [],
  },
}

export const ageBiasYoungPatient: TherapeuticSession = {
  ...baselineAnxietyScenario,
  sessionId: 'young-patient-001',
  participantDemographics: {
    ...baselineAnxietyScenario.participantDemographics,
    age: '18-25',
  },
  content: {
    ...baselineAnxietyScenario.content,
    transcript: `Young patient with anxiety about college. Therapeutic interventions: Active listening, Cognitive restructuring. Patient responses: I feel anxious about work, That makes sense. Session notes: Patient responsive to interventions.`,
  },
}

export const ageBiasElderlyPatient: TherapeuticSession = {
  ...baselineAnxietyScenario,
  sessionId: 'elderly-patient-001',
  participantDemographics: {
    ...baselineAnxietyScenario.participantDemographics,
    age: '65+',
    gender: 'female',
  },
  content: {
    ...baselineAnxietyScenario.content,
    transcript: `Elderly patient with anxiety about health. Therapeutic interventions: Active listening, Cognitive restructuring. Patient responses: I feel anxious about work, That makes sense. Session notes: Patient responsive to interventions.`,
  },
}

export function getComparativeBiasScenarios(): [
  TherapeuticSession,
  TherapeuticSession,
][] {
  const favorableScenario: TherapeuticSession = {
    ...baselineAnxietyScenario,
    sessionId: 'favorable-001',
    participantDemographics: {
      ...baselineAnxietyScenario.participantDemographics,
      ethnicity: 'white',
      gender: 'male',
    },
  }

  const unfavorableScenario: TherapeuticSession = {
    ...baselineAnxietyScenario,
    sessionId: 'unfavorable-001',
    participantDemographics: {
      ...baselineAnxietyScenario.participantDemographics,
      ethnicity: 'black',
      gender: 'female',
    },
  }

  return [[favorableScenario, unfavorableScenario]]
}

// =======================
// TEST MOCKS FOR BIAS ENGINE UNIT TESTS – ADDED FOR TYPE ERRORS
// =======================

export const mockPythonBridge = {
  initialize: vi.fn(),
  checkHealth: vi.fn(),
  runPreprocessingAnalysis: vi.fn(),
  runModelLevelAnalysis: vi.fn(),
  runInteractiveAnalysis: vi.fn(),
  runEvaluationAnalysis: vi.fn(),
  analyze_session: vi.fn(),
}

export function createDefaultAnalysisResult() {
  return {
    biasScore: 0.5,
    linguisticBias: {
      genderBiasScore: 0,
      racialBiasScore: 0,
      ageBiasScore: 0,
      culturalBiasScore: 0,
      biasedTerms: [],
      sentimentAnalysis: {
        overallSentiment: 0,
        emotionalValence: 0,
        subjectivity: 0,
        demographicVariations: {},
      },
    },
    representationAnalysis: {
      demographicDistribution: {},
      underrepresentedGroups: [],
      overrepresentedGroups: [],
      diversityIndex: 0,
      intersectionalityAnalysis: [],
    },
    dataQualityMetrics: {
      completeness: 1,
      consistency: 1,
      accuracy: 1,
      timeliness: 1,
      validity: 1,
      missingDataByDemographic: {},
    },
    recommendations: [],
  }
}

export function createModelLevelAnalysisResult() {
  return {
    biasScore: 0.5,
    fairnessMetrics: {
      demographicParity: 0.5,
      equalizedOdds: 0.5,
      equalOpportunity: 0.5,
      calibration: 0.5,
      individualFairness: 0.5,
      counterfactualFairness: 0.5,
    },
    performanceMetrics: {
      accuracy: 0.5,
      precision: 0.5,
      recall: 0.5,
      f1Score: 0.5,
      auc: 0.5,
      calibrationError: 0,
      demographicBreakdown: {},
    },
    groupPerformanceComparison: [],
    recommendations: [],
  }
}

export function createInteractiveAnalysisResult() {
  return {
    biasScore: 0.5,
    counterfactualAnalysis: {
      scenariosAnalyzed: 2,
      biasDetected: false,
      consistencyScore: 0,
      problematicScenarios: [],
    },
    featureImportance: [],
    whatIfScenarios: [],
    recommendations: [],
  }
}

export function createEvaluationAnalysisResult() {
  return {
    biasScore: 0.5,
    huggingFaceMetrics: {
      toxicity: 0,
      bias: 0,
      regard: {},
      stereotype: 0,
      fairness: 0,
    },
    customMetrics: {
      therapeuticBias: 0,
      culturalSensitivity: 0,
      professionalEthics: 0,
      patientSafety: 0,
    },
    temporalAnalysis: {
      trendDirection: 'stable',
      changeRate: 0,
      seasonalPatterns: [],
      interventionEffectiveness: [],
    },
    recommendations: [],
  }
}
