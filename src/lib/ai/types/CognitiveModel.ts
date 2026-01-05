/**
 * Types for cognitive models used in patient simulations
 */

/**
 * Demographic information for a cognitive model
 */
export type DemographicInfo = {
  age: number
  gender: string
  occupation: string
  familyStatus: string
  culturalFactors: string[]
}

/**
 * Diagnosis information for a cognitive model
 */
export type DiagnosisInfo = {
  primaryDiagnosis: string
  secondaryDiagnoses: string[]
  durationOfSymptoms: string
  severity: 'mild' | 'moderate' | 'severe'
}

/**
 * Core belief structure
 */
export type CoreBelief = {
  belief: string
  strength: number
  evidence: string[]
  formationContext: string
  relatedDomains: string[]
}

/**
 * Cognitive distortion pattern
 */
export type DistortionPattern = {
  type: string
  examples: string[]
  triggerThemes: string[]
  frequency: 'occasional' | 'frequent' | 'pervasive'
}

/**
 * Behavioral pattern
 */
export type BehavioralPattern = {
  trigger: string
  response: string
  reinforcers: string[]
  consequences: string[]
  alternateTried: string[]
}

/**
 * Emotional pattern
 */
export type EmotionalPattern = {
  emotion: string
  intensity: number
  triggers: string[]
  physicalManifestations: string[]
  copingMechanisms: string[]
}

/**
 * Relationship pattern
 */
export type RelationshipPattern = {
  type: string
  expectations: string[]
  fears: string[]
  behaviors: string[]
  historicalOutcomes: string[]
}

/**
 * Formative experience
 */
export type FormativeExperience = {
  age: number | string
  event: string
  impact: string
  beliefsFormed: string[]
  emotionalResponse: string
}

/**
 * Therapy history
 */
export type TherapyHistory = {
  previousApproaches: string[]
  helpfulInterventions: string[]
  unhelpfulInterventions: string[]
  insights: string[]
  progressMade: string
  remainingChallenges: string[]
}

/**
 * Conversational style
 */
export type ConversationalStyle = {
  verbosity: number
  emotionalExpressiveness: number
  insightLevel: number
  preferredCommunicationModes: string[]
}

/**
 * Therapeutic insight
 */
export type TherapeuticInsight = {
  belief: string
  insight: string
  dateAchieved: string
}

/**
 * Session progress
 */
export type SessionProgress = {
  sessionNumber: number
  keyInsights: string[]
  resistanceShift: number
}

/**
 * Represents a skill acquired by the patient during therapy.
 */
export type SkillAcquired = {
  skillName: string // Name of the skill, e.g., "Deep Breathing", "Cognitive Reframing"
  dateAchieved: string // ISO 8601 date-time string when the skill was considered acquired/practiced
  proficiency: number // Scale of 0-1 indicating how well the patient has learned/can apply the skill
  // Optional: Add context like situations where the skill is applicable or practiced
  applicationContext?: string[]
}

/**
 * Therapeutic progress
 */
export type TherapeuticProgress = {
  insights: TherapeuticInsight[]
  skillsAcquired: SkillAcquired[] // Added new field for tracking acquired skills
  resistanceLevel: number // Scale 0-10, how much patient resists therapeutic direction
  changeReadiness:
    | 'precontemplation'
    | 'contemplation'
    | 'preparation'
    | 'action'
    | 'maintenance'
  sessionProgressLog: SessionProgress[]
  trustLevel: number // Scale 0-10, patient's trust in the therapist
  rapportScore: number // Scale 0-10, overall quality of patient-therapist relationship
  therapistPerception: // Patient's current view of the therapist's stance
  | 'supportive'
    | 'neutral'
    | 'understanding'
    | 'confusing'
    | 'challenging'
    | 'dismissive'
    | 'unhelpful'
  transferenceState: // Patient's active transference pattern towards the therapist
  | 'none'
    | 'positive-idealizing' // Sees therapist as overly positive, perfect, or saviour-like
    | 'negative-critical' // Sees therapist as judgmental, harmful, or reminiscent of a negative figure
    | 'maternal' // Experiences therapist as a mother figure
    | 'paternal' // Experiences therapist as a father figure
    | 'eroticized' // Experiences romantic or sexual feelings towards therapist
    | 'dependent' // Feels overly reliant on the therapist for validation or decision making
}

/**
 * Patient response style configuration
 */
export type PatientResponseStyleConfig = {
  openness: number
  coherence: number
  defenseLevel: number
  disclosureStyle: 'open' | 'selective' | 'guarded'
  challengeResponses: 'defensive' | 'curious' | 'dismissive'
}

// This type definition is duplicated in PatientResponseService.ts and is more elaborate there.
// The PatientResponseService.ts version should be considered the source of truth for dynamic response styling.
// This definition here is being removed to avoid confusion and maintain a single source of truth.
// The ConversationalStyle type above can store baseline patient communication traits.

/**
 * Complete cognitive model for patient simulation
 */
export type CognitiveModel = {
  id: string
  name: string
  demographicInfo: DemographicInfo
  presentingIssues: string[]
  diagnosisInfo: DiagnosisInfo
  coreBeliefs: CoreBelief[]
  distortionPatterns: DistortionPattern[]
  behavioralPatterns: BehavioralPattern[]
  emotionalPatterns: EmotionalPattern[]
  relationshipPatterns: RelationshipPattern[]
  formativeExperiences: FormativeExperience[]
  therapyHistory: TherapyHistory
  conversationalStyle: ConversationalStyle
  goalsForTherapy: string[]
  therapeuticProgress: TherapeuticProgress
}
