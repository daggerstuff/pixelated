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
