import type { TherapeuticSession } from '../types'
/**
 * Test fixtures for bias detection scenarios
 */

export const baselineAnxietyScenario: TherapeuticSession = {
  sessionId: 'baseline-anxiety-001',
  timestamp: new Date(),
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
    complexity: 'intermediate',
    tags: ['anxiety', 'baseline'],
    description: 'Standard anxiety management scenario',
    learningObjectives: ['assess anxiety', 'provide coping strategies'],
  },
  content: {
    patientPresentation: 'Patient presents with moderate anxiety symptoms',
    therapeuticInterventions: ['Active listening', 'Cognitive restructuring'],
    patientResponses: ['I feel anxious about work', 'That makes sense'],
    sessionNotes: 'Patient responsive to interventions',
  },
  aiResponses: [
    {
      responseId: 'resp-001',
      type: 'intervention',
      content: 'I understand your concerns about work stress',
      timestamp: new Date(),
      confidence: 0.85,
      modelUsed: 'gpt-4',
    },
  ],
  expectedOutcomes: [
    {
      outcomeId: 'outcome-001',
      type: 'therapeutic-alliance',
      expectedValue: 0.8,
      actualValue: 0.82,
    },
  ],
  transcripts: [
    {
      speakerId: 'patient',
      content: 'I feel anxious about work deadlines',
      timestamp: new Date(),
      emotionalTone: 'anxious',
    },
  ],
  metadata: {
    trainingInstitution: 'Test University',
    traineeId: 'trainee-001',
    sessionDuration: 30,
    completionStatus: 'completed',
    technicalIssues: [],
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
    patientPresentation: 'Young patient with anxiety about college',
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
    patientPresentation: 'Elderly patient with anxiety about health',
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
  initialize: jest.fn(),
  checkHealth: jest.fn(),
  runPreprocessingAnalysis: jest.fn(),
  runModelLevelAnalysis: jest.fn(),
  runInteractiveAnalysis: jest.fn(),
  runEvaluationAnalysis: jest.fn(),
  analyze_session: jest.fn(),
}

export function createDefaultAnalysisResult() {
  return {
    biasScore: 0.5,
    linguisticBias: { genderBiasScore: 0, racialBiasScore: 0, ageBiasScore: 0, culturalBiasScore: 0, biasedTerms: [], sentimentAnalysis: { overallSentiment: 0, emotionalValence: 0, subjectivity: 0, demographicVariations: {} } },
    representationAnalysis: { demographicDistribution: {}, underrepresentedGroups: [], overrepresentedGroups: [], diversityIndex: 0, intersectionalityAnalysis: [] },
    dataQualityMetrics: { completeness: 1, consistency: 1, accuracy: 1, timeliness: 1, validity: 1, missingDataByDemographic: {} },
    recommendations: [],
  }
}

export function createModelLevelAnalysisResult() {
  return {
    biasScore: 0.5,
    fairnessMetrics: { demographicParity: 0.5, equalizedOdds: 0.5, equalOpportunity: 0.5, calibration: 0.5, individualFairness: 0.5, counterfactualFairness: 0.5 },
    performanceMetrics: { accuracy: 0.5, precision: 0.5, recall: 0.5, f1Score: 0.5, auc: 0.5, calibrationError: 0, demographicBreakdown: {} },
    groupPerformanceComparison: [],
    recommendations: [],
  }
}

export function createInteractiveAnalysisResult() {
  return {
    biasScore: 0.5,
    counterfactualAnalysis: { scenariosAnalyzed: 2, biasDetected: false, consistencyScore: 0, problematicScenarios: [] },
    featureImportance: [],
    whatIfScenarios: [],
    recommendations: [],
  }
}

export function createEvaluationAnalysisResult() {
  return {
    biasScore: 0.5,
    huggingFaceMetrics: { toxicity: 0, bias: 0, regard: {}, stereotype: 0, fairness: 0 },
    customMetrics: { therapeuticBias: 0, culturalSensitivity: 0, professionalEthics: 0, patientSafety: 0 },
    temporalAnalysis: { trendDirection: "stable", changeRate: 0, seasonalPatterns: [], interventionEffectiveness: [] },
    recommendations: [],
  }
}