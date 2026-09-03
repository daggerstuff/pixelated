/**
 * Patient response type definitions.
 * Extracted from PatientResponseService.ts; pure type surface, no runtime logic.
 */

import type { PatientProfile } from '../models/patient'

/**
 * Defines the nuance of emotional expression.
 * - 'subtle': Emotions are hinted at, not overtly stated.
 * - 'overt': Emotions are clearly expressed.
 * - 'suppressed': Patient attempts to hide or downplay emotions.
 */
export type EmotionalNuance = 'subtle' | 'overt' | 'suppressed'

/**
 * Defines how non-verbal cues are expressed in text.
 * - 'none': No explicit description of non-verbal cues.
 * - 'minimal': Occasional, brief descriptions (e.g., *sighs*).
 * - 'descriptive': More detailed descriptions of actions, expressions, tone.
 */
export type NonVerbalIndicatorStyle = 'none' | 'minimal' | 'descriptive'

/**
 * Specific defensive mechanisms the patient might employ.
 * - 'none': No specific active defensive mechanism.
 * - 'denial': Refusing to accept reality or a fact.
 * - 'projection': Attributing one's own unacceptable thoughts or feelings to others.
 * - 'deflection': Avoiding a topic or question by changing the subject.
 * - 'intellectualization': Focusing on abstract thought to avoid emotions.
 * - 'minimization': Downplaying the significance of a behavior or event.
 */
export type DefensiveMechanism =
  | 'none'
  | 'denial'
  | 'projection'
  | 'deflection'
  | 'intellectualization'
  | 'minimization'

/**
 * Analysis result for therapist utterances
 */
export type TherapistUtteranceAnalysis = {
  trustChange: number
  rapportChange: number
  perception: string
}

/**
 * Analysis result for patient utterances
 */
export type PatientUtteranceAnalysis = {
  trustChange: number
  rapportChange: number
  updatedPerception: string
}

/**
 * Valid therapist perception values
 */
export type TherapistPerception =
  | 'understanding'
  | 'challenging'
  | 'dismissive'
  | 'supportive'
  | 'confusing'
  | 'neutral'

/**
 * Valid transference state values
 */
export type TransferenceState =
  | 'none'
  | 'maternal'
  | 'paternal'
  | 'positive-idealizing'
  | 'negative-critical'


/**
 * Patient response style configuration
 */
export type PatientResponseStyleConfig = {
  openness: number // Scale of 0-10, how willing to share
  coherence: number // Scale of 0-10, how logical and easy to follow
  defenseLevel: number // Scale of 0-10, general guardedness

  disclosureStyle: 'open' | 'selective' | 'guarded' // How patient filters information
  challengeResponses: 'defensive' | 'curious' | 'dismissive' | 'compliant' // How patient reacts to therapist challenges

  // New fields for enhanced emotional authenticity
  emotionalNuance: EmotionalNuance // How explicitly emotions are shown
  emotionalIntensity: number // Scale of 0-1, how strong the expressed emotion is
  primaryEmotion?: string // Optional: specify a dominant emotion for the response (e.g., "sadness", "anger")
  nonVerbalIndicatorStyle: NonVerbalIndicatorStyle // How non-verbal cues are textually represented

  // New fields for resistance and defensive mechanisms
  activeDefensiveMechanism: DefensiveMechanism // Specific defense mechanism to employ
  resistanceLevel: number // Scale of 0-10, how much patient resists therapeutic direction
}

/**
 * Response context for generating patient responses
 */
export type ResponseContext = {
  profile: PatientProfile
  styleConfig: PatientResponseStyleConfig
  therapeuticFocus?: string[] | undefined
  sessionNumber: number
}

export type ResponseContextInput = Omit<ResponseContext, 'profile'> & {
  profile?: PatientProfile
}
