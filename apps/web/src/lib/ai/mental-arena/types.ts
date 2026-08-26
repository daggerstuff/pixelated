/**
 * Mental Arena types for synthetic therapy conversation generation
 */

export enum DisorderCategory {
  Anxiety = 'anxiety',
  Depression = 'depression',
  PTSD = 'ptsd',
  ADHD = 'adhd',
  OCD = 'ocd',
  BipolarDisorder = 'bipolar_disorder',
  EatingDisorder = 'eating_disorder',
  SocialAnxiety = 'social_anxiety',
  PanicDisorder = 'panic_disorder',
  Trauma = 'trauma',
}

export interface MentalArenaConfig {
  numSessions: number
  maxTurns: number
  disorders: DisorderCategory[]
  usePythonBridge: boolean
  model: string
}

export interface SyntheticConversation {
  patientText: string
  therapistText: string
  encodedSymptoms: Array<{
    name: string
    severity: number
    duration: string
    manifestations: string[]
    cognitions: string[]
  }>
  decodedSymptoms: string[]
  sessionSummary?: string
  accuracyScore?: number
}

export interface SymptomEncodingResult {
  symptoms: Array<{
    name: string
    severity: number
    duration: string
    manifestations: string[]
    cognitions: string[]
  }>
  metadata: {
    disorderCategory: DisorderCategory
    sessionId: string
    timestamp: string
  }
}

export interface TherapistDecodingResult {
  identifiedSymptoms: string[]
  accuracyScore: number
  missedSymptoms: string[]
  falsePositives: string[]
  analysis: {
    correctlyIdentified: string[]
    missed: string[]
    incorrect: string[]
  }
}
