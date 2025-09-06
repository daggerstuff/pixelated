/**
 * Mental Arena - Production-grade synthetic therapeutic conversation generation
 *
 * This module provides comprehensive tools for generating and managing synthetic
 * therapeutic conversations for training and evaluation of mental health AI systems.
 */

// Core components
export { MentalArenaAdapter } from './MentalArenaAdapter.ts'
export { MentalArenaPythonBridge } from './MentalArenaPythonBridge.ts'

// Type definitions from existing types file
export { DisorderCategory } from './types.ts'

export type {
  MentalArenaConfig,
  SyntheticConversation,
  SymptomEncodingResult,
  TherapistDecodingResult,
} from './types.ts'

// Import types for internal use
import { DisorderCategory } from './types.ts'
import type { MentalArenaConfig, SyntheticConversation } from './types.ts'

// Version information
export const VERSION = '1.0.0'

/**
 * Utility function to create basic mental arena configuration
 */
export function createBasicConfig(
  numSessions: number = 10,
  disorders: DisorderCategory[] = [
    DisorderCategory.Anxiety,
    DisorderCategory.Depression,
  ],
): MentalArenaConfig {
  return {
    numSessions,
    maxTurns: 8,
    disorders,
    usePythonBridge: true,
    model: 'gpt-4',
  }
}

/**
 * Production-grade validation interface for conversation quality assessment
 */
export interface ValidationResult {
  isValid: boolean
  qualityScore: number
  issues: ValidationIssue[]
  recommendations: string[]
}

export interface ValidationIssue {
  type: 'clinical' | 'conversational' | 'ethical' | 'technical'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  location?: string
  suggestion?: string
}

/**
 * Comprehensive conversation validation for production use
 *
 * Performs multi-dimensional validation including:
 * - Clinical accuracy and therapeutic appropriateness
 * - Conversational flow and coherence
 * - Ethical considerations and safety checks
 * - Technical quality and completeness
 *
 * @param conversation - The synthetic conversation to validate
 * @returns Detailed validation result with quality score and actionable feedback
 */
export function validateConversation(
  conversation: SyntheticConversation,
): ValidationResult {
  const issues: ValidationIssue[] = []
  let qualityScore = 100 // Start with perfect score and deduct for issues

  // Clinical validation
  const clinicalIssues = validateClinicalAccuracy(conversation)
  issues.push(...clinicalIssues)
  qualityScore -= clinicalIssues.length * 10

  // Conversational flow validation
  const flowIssues = validateConversationalFlow(conversation)
  issues.push(...flowIssues)
  qualityScore -= flowIssues.length * 5

  // Ethical considerations validation
  const ethicalIssues = validateEthicalConsiderations(conversation)
  issues.push(...ethicalIssues)
  qualityScore -= ethicalIssues.length * 15

  // Technical validation
  const technicalIssues = validateTechnicalQuality(conversation)
  issues.push(...technicalIssues)
  qualityScore -= technicalIssues.length * 3

  const isValid =
    qualityScore >= (conversation.accuracyScore ? 70 : 60) &&
    !issues.some((i) => i.severity === 'critical')

  return {
    isValid,
    qualityScore: Math.max(0, qualityScore),
    issues,
    recommendations: generateRecommendations(issues),
  }
}

/**
 * Simple conversation validation for basic checks (backward compatibility)
 *
 * @deprecated Use validateConversation() for production validation
 * @param conversation - The synthetic conversation to validate
 * @returns true if conversation passes basic structural checks
 */
export function validateConversationBasic(
  conversation: SyntheticConversation,
): boolean {
  return (
    conversation.patientText.length > 0 &&
    conversation.therapistText.length > 0 &&
    conversation.encodedSymptoms.length > 0
  )
}

// Internal validation functions

function validateClinicalAccuracy(
  conversation: SyntheticConversation,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check accuracy score threshold
  if (
    conversation.accuracyScore !== undefined &&
    conversation.accuracyScore < 50
  ) {
    issues.push({
      type: 'clinical',
      severity: 'high',
      description: `Low symptom identification accuracy: ${conversation.accuracyScore.toFixed(1)}%`,
      suggestion:
        'Review symptom encoding clarity and therapeutic response quality',
    })
  }

  // Validate symptom structure and content
  for (const [index, symptom] of conversation.encodedSymptoms.entries()) {
    if (!symptom.name || symptom.name.trim().length === 0) {
      issues.push({
        type: 'clinical',
        severity: 'high',
        description: `Empty symptom name at index ${index}`,
        location: `encodedSymptoms[${index}]`,
        suggestion: 'Ensure all symptoms have valid names',
      })
    }

    if (symptom.severity < 0 || symptom.severity > 10) {
      issues.push({
        type: 'clinical',
        severity: 'medium',
        description: `Invalid severity score: ${symptom.severity} (should be 0-10)`,
        location: `encodedSymptoms[${index}].severity`,
        suggestion: 'Normalize severity scores to 0-10 scale',
      })
    }

    if (!symptom.manifestations || symptom.manifestations.length === 0) {
      issues.push({
        type: 'clinical',
        severity: 'medium',
        description: `No manifestations provided for symptom: ${symptom.name}`,
        location: `encodedSymptoms[${index}].manifestations`,
        suggestion: 'Include behavioral manifestations for all symptoms',
      })
    }
  }

  // Check symptom-conversation alignment
  const patientTextLower = conversation.patientText.toLowerCase()
  const missingSymptomReferences = conversation.encodedSymptoms.filter(
    (symptom) =>
      !symptom.manifestations.some((manifestation) =>
        patientTextLower.includes(manifestation.toLowerCase()),
      ),
  )

  if (missingSymptomReferences.length > 0) {
    issues.push({
      type: 'clinical',
      severity: 'medium',
      description: `${missingSymptomReferences.length} symptoms not reflected in patient text`,
      suggestion:
        'Ensure symptom manifestations are naturally integrated into conversation',
    })
  }

  return issues
}

function validateConversationalFlow(
  conversation: SyntheticConversation,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check minimum content length
  if (conversation.patientText.length < 100) {
    issues.push({
      type: 'conversational',
      severity: 'medium',
      description: 'Patient text too brief for meaningful analysis',
      location: 'patientText',
      suggestion: 'Increase conversation depth and patient expression length',
    })
  }

  if (conversation.therapistText.length < 100) {
    issues.push({
      type: 'conversational',
      severity: 'medium',
      description: 'Therapist text too brief for therapeutic value',
      location: 'therapistText',
      suggestion:
        'Enhance therapeutic responses with more detailed interventions',
    })
  }

  // Check for conversation balance
  const patientWordCount = conversation.patientText.split(/\s+/).length
  const therapistWordCount = conversation.therapistText.split(/\s+/).length
  const ratio = patientWordCount / therapistWordCount

  if (ratio < 0.5 || ratio > 3) {
    issues.push({
      type: 'conversational',
      severity: 'low',
      description: `Unbalanced conversation ratio: ${ratio.toFixed(2)} (patient/therapist words)`,
      suggestion:
        'Aim for balanced dialogue with appropriate patient expression and therapist guidance',
    })
  }

  // Check for repetitive patterns
  const patientSentences = conversation.patientText
    .split(/[.!?]+/)
    .filter((s) => s.trim().length > 0)
  const uniqueSentences = new Set(
    patientSentences.map((s) => s.trim().toLowerCase()),
  )
  const repetitionRatio = uniqueSentences.size / patientSentences.length

  if (repetitionRatio < 0.8) {
    issues.push({
      type: 'conversational',
      severity: 'low',
      description: `High repetition in patient text: ${((1 - repetitionRatio) * 100).toFixed(1)}%`,
      suggestion:
        'Reduce repetitive language patterns for more natural conversation flow',
    })
  }

  return issues
}

function validateEthicalConsiderations(
  conversation: SyntheticConversation,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const combinedText = (
    conversation.patientText +
    ' ' +
    conversation.therapistText
  ).toLowerCase()

  // Check for high-risk content
  const criticalPatterns = [
    { pattern: /suicid[aeilous]/g, description: 'suicidal ideation' },
    { pattern: /self.?harm/g, description: 'self-harm references' },
    { pattern: /kill.?(myself|self)/g, description: 'self-harm language' },
  ]

  criticalPatterns.forEach(({ pattern, description }) => {
    if (pattern.test(combinedText)) {
      issues.push({
        type: 'ethical',
        severity: 'critical',
        description: `Contains potentially harmful content: ${description}`,
        suggestion:
          'Review content for crisis intervention protocols and safety measures',
      })
    }
  })

  // Check for inappropriate therapeutic responses
  const inappropriateTherapistPatterns = [
    {
      pattern: /you should (just|simply)/gi,
      description: 'minimizing language',
    },
    {
      pattern: /that's (wrong|bad|stupid)/gi,
      description: 'judgmental language',
    },
    { pattern: /i think you're/gi, description: 'overly personal opinions' },
  ]

  inappropriateTherapistPatterns.forEach(({ pattern, description }) => {
    if (pattern.test(conversation.therapistText)) {
      issues.push({
        type: 'ethical',
        severity: 'high',
        description: `Inappropriate therapeutic response: ${description}`,
        location: 'therapistText',
        suggestion: 'Use empathetic, non-judgmental therapeutic language',
      })
    }
  })

  // Check for privacy concerns
  const privacyPatterns = [
    /\b\d{3}-\d{3}-\d{4}\b/g, // Phone numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email addresses
    /\b\d{3}-\d{2}-\d{4}\b/g, // SSN-like patterns
  ]

  privacyPatterns.forEach((pattern) => {
    if (pattern.test(combinedText)) {
      issues.push({
        type: 'ethical',
        severity: 'high',
        description: 'Potential personal identifying information detected',
        suggestion:
          'Remove or anonymize personal information to protect privacy',
      })
    }
  })

  return issues
}

function validateTechnicalQuality(
  conversation: SyntheticConversation,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // Check for required fields
  if (!conversation.sessionSummary) {
    issues.push({
      type: 'technical',
      severity: 'low',
      description: 'Missing session summary',
      location: 'sessionSummary',
      suggestion: 'Generate comprehensive session summary for documentation',
    })
  }

  if (conversation.decodedSymptoms.length === 0) {
    issues.push({
      type: 'technical',
      severity: 'medium',
      description: 'No decoded symptoms identified',
      location: 'decodedSymptoms',
      suggestion: 'Ensure therapist analysis identifies relevant symptoms',
    })
  }

  // Check text encoding and formatting
  const hasInvalidChars = (text: string): boolean => {
    // Check for control characters (except common whitespace) and extended ASCII
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i)
      if (
        (code > 0 && code < 32 && code !== 9 && code !== 10 && code !== 13) ||
        code > 126
      ) {
        return true
      }
    }
    return false
  }

  if (
    hasInvalidChars(conversation.patientText) ||
    hasInvalidChars(conversation.therapistText)
  ) {
    issues.push({
      type: 'technical',
      severity: 'low',
      description: 'Non-ASCII characters detected',
      suggestion: 'Normalize text encoding for consistent processing',
    })
  }

  // Check for malformed JSON in symptom data
  try {
    JSON.stringify(conversation.encodedSymptoms)
  } catch {
    issues.push({
      type: 'technical',
      severity: 'high',
      description: 'Malformed symptom data structure',
      location: 'encodedSymptoms',
      suggestion: 'Validate and fix symptom data serialization',
    })
  }

  // Check for excessive whitespace or formatting issues
  const excessiveWhitespace = /\s{3,}/g
  if (
    excessiveWhitespace.test(conversation.patientText) ||
    excessiveWhitespace.test(conversation.therapistText)
  ) {
    issues.push({
      type: 'technical',
      severity: 'low',
      description: 'Excessive whitespace in conversation text',
      suggestion: 'Normalize whitespace for clean formatting',
    })
  }

  return issues
}

function generateRecommendations(issues: ValidationIssue[]): string[] {
  const recommendations = issues
    .filter((issue) => issue.suggestion)
    .map((issue) => issue.suggestion!)
    .filter((suggestion, index, array) => array.indexOf(suggestion) === index) // Remove duplicates

  // Add general recommendations based on issue patterns
  const criticalIssues = issues.filter((i) => i.severity === 'critical')
  const clinicalIssues = issues.filter((i) => i.type === 'clinical')
  const ethicalIssues = issues.filter((i) => i.type === 'ethical')

  if (criticalIssues.length > 0) {
    recommendations.unshift(
      'URGENT: Address critical safety and ethical concerns before use',
    )
  }

  if (clinicalIssues.length > 2) {
    recommendations.push(
      'Consider clinical expert review for therapeutic accuracy',
    )
  }

  if (ethicalIssues.length > 1) {
    recommendations.push(
      'Implement additional ethical safeguards and content filtering',
    )
  }

  return recommendations
}
