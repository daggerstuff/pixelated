import { z } from 'zod'

const TherapeuticSessionSchema = z.object({
  sessionId: z.string(),
  timestamp: z.instanceof(Date),
  participantDemographics: z.object({
    age: z.string(),
    gender: z.string(),
    ethnicity: z.string(),
    primaryLanguage: z.string(),
    socioeconomicStatus: z.string().optional(),
    education: z.string().optional(),
    region: z.string().optional(),
    culturalBackground: z.array(z.string()).optional(),
    disabilityStatus: z.string().optional(),
  }),
  scenario: z.object({
    scenarioId: z.string(),
    type: z.enum([
      'depression',
      'anxiety',
      'trauma',
      'substance-abuse',
      'grief',
      'other',
    ]),
    complexity: z.enum(['beginner', 'intermediate', 'advanced']),
    tags: z.array(z.string()),
    description: z.string(),
    learningObjectives: z.array(z.string()),
  }),
  content: z.object({
    patientPresentation: z.string(),
    therapeuticInterventions: z.array(z.string()),
    patientResponses: z.array(z.string()),
    sessionNotes: z.string(),
    assessmentResults: z.record(z.unknown()).optional(),
  }),
  aiResponses: z.array(
    z.object({
      responseId: z.string(),
      timestamp: z.instanceof(Date),
      type: z.enum([
        'diagnostic',
        'intervention',
        'risk-assessment',
        'recommendation',
      ]),
      content: z.string(),
      confidence: z.number(),
      modelUsed: z.string(),
      reasoning: z.string().optional(),
    }),
  ),
  transcripts: z.array(
    z.object({
      speakerId: z.string(),
      timestamp: z.instanceof(Date),
      content: z.string(),
      emotionalTone: z.string().optional(),
      confidenceLevel: z.number().optional(),
    }),
  ),
  metadata: z.object({
    trainingInstitution: z.string(),
    supervisorId: z.string().optional(),
    traineeId: z.string(),
    sessionDuration: z.number(),
    completionStatus: z.enum(['completed', 'partial', 'abandoned']),
    technicalIssues: z.array(z.string()).optional(),
  }),
})

export { TherapeuticSessionSchema }

// Example session data for testing
const session = {
  sessionId: 'example-session-id',
  timestamp: new Date(),
  participantDemographics: {
    age: '26-35',
    gender: 'prefer-not-to-say',
    ethnicity: 'not-specified',
    primaryLanguage: 'en',
    socioeconomicStatus: 'middle',
    education: 'bachelor',
    region: 'unknown',
  },
  scenario: {
    scenarioId: 'scenario-id-test',
    type: 'depression',
    complexity: 'beginner',
    tags: ['test'],
    description: 'Test scenario description',
    learningObjectives: ['Objective 1'],
  },
  content: {
    patientPresentation: 'Test patient presentation',
    therapeuticInterventions: ['Intervention 1'],
    patientResponses: ['Response 1'],
    sessionNotes: 'Session notes here',
  },
  aiResponses: [],
  transcripts: [],
  metadata: {
    trainingInstitution: 'Test Institution',
    traineeId: 'trainee-test-id',
    sessionDuration: 30,
    completionStatus: 'partial',
  },
}

// Validation function for testing (call manually when needed)
export function validateExampleSession() {
  try {
    const rawSession = TherapeuticSessionSchema.parse(session)
    console.log('Session validation successful:', rawSession)
    return rawSession
  } catch (error) {
    console.error('Error parsing session data:', error)
    throw error
  }
}
