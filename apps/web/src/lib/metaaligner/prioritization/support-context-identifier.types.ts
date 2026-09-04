/**
 * Support context identifier types — extracted from support-context-identifier.ts.
 */

import type { AIService } from '../../ai/models/ai-types'

export interface UserEmotionalProfile {
  baselineEmotionalState?: EmotionalState
  typicalCopingStrategies?: string[]
  emotionalTriggers?: string[]
  supportPreferences?: string[]
}

export interface SupportContextResult {
  isSupport: boolean
  confidence: number
  supportType: SupportType
  emotionalState: EmotionalState
  urgency: 'low' | 'medium' | 'high'
  supportNeeds: SupportNeed[]
  recommendedApproach: RecommendedApproach
  emotionalIntensity: number // 0-1 scale
  metadata: {
    emotionalIndicators: string[]
    copingCapacity: 'high' | 'medium' | 'low'
    socialSupport: 'strong' | 'moderate' | 'limited' | 'unknown'
    immediateNeeds: string[]
    triggerEvents?: string[]
    resilientFactors?: string[]
    requiresHumanReview?: boolean
    crisisInterventionFlagged?: boolean
  }
}

export enum SupportType {
  EMOTIONAL_VALIDATION = 'emotional_validation', // "I feel terrible and need someone to understand"
  COPING_ASSISTANCE = 'coping_assistance', // "I don't know how to handle this"
  ENCOURAGEMENT = 'encouragement', // "I'm losing hope and need motivation"
  ACTIVE_LISTENING = 'active_listening', // "I just need someone to listen"
  PRACTICAL_GUIDANCE = 'practical_guidance', // "What should I do about..."
  GRIEF_SUPPORT = 'grief_support', // "I'm grieving a loss"
  RELATIONSHIP_SUPPORT = 'relationship_support', // "Having relationship problems"
  STRESS_MANAGEMENT = 'stress_management', // "I'm overwhelmed with stress"
  IDENTITY_SUPPORT = 'identity_support', // "I don't know who I am anymore"
  TRANSITION_SUPPORT = 'transition_support', // "Going through major life changes"
  TRAUMA_SUPPORT = 'trauma_support', // "Dealing with past trauma"
  DAILY_FUNCTIONING = 'daily_functioning', // "Struggling with day-to-day activities"
}

export enum EmotionalState {
  SADNESS = 'sadness',
  ANXIETY = 'anxiety',
  ANGER = 'anger',
  FEAR = 'fear',
  GUILT = 'guilt',
  SHAME = 'shame',
  LONELINESS = 'loneliness',
  HELPLESSNESS = 'helplessness',
  HOPELESSNESS = 'hopelessness',
  OVERWHELM = 'overwhelm',
  NUMBNESS = 'numbness',
  CONFUSION = 'confusion',
  MIXED_EMOTIONS = 'mixed_emotions',
}

export enum SupportNeed {
  VALIDATION = 'validation',
  PRACTICAL_ADVICE = 'practical_advice',
  EMOTIONAL_REGULATION = 'emotional_regulation',
  PERSPECTIVE_TAKING = 'perspective_taking',
  RESOURCE_CONNECTION = 'resource_connection',
  SAFETY_PLANNING = 'safety_planning',
  HOPE_RESTORATION = 'hope_restoration',
  SKILL_BUILDING = 'skill_building',
  RELATIONSHIP_REPAIR = 'relationship_repair',
  MEANING_MAKING = 'meaning_making',
}

export enum RecommendedApproach {
  EMPATHETIC_LISTENING = 'empathetic_listening',
  GENTLE_GUIDANCE = 'gentle_guidance',
  COGNITIVE_REFRAMING = 'cognitive_reframing',
  EMOTIONAL_REGULATION = 'emotional_regulation',
  PROBLEM_SOLVING = 'problem_solving',
  RESOURCE_REFERRAL = 'resource_referral',
  CRISIS_INTERVENTION = 'crisis_intervention',
  PSYCHOEDUCATION = 'psychoeducation',
  MINDFULNESS_BASED = 'mindfulness_based',
  STRENGTH_BASED = 'strength_based',
}

export interface SupportIdentifierConfig {
  aiService: AIService
  model?: string
  enableEmotionalAnalysis?: boolean
  enableCopingAssessment?: boolean
  adaptToEmotionalState?: boolean
}
/**
 * Patterns that indicate queries are informational/casual and NOT seeking support.
 * This must be defined exactly once at module scope, before any use.
 */
