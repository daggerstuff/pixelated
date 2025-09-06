/**
 * Core mental health objectives for MetaAligner integration
 * Defines the fundamental alignment objectives for mental health AI responses
 */

export interface ObjectiveDefinition {
  id: string
  name: string
  description: string
  weight: number
  criteria: ObjectiveCriteria[]
  evaluationFunction: (response: string, context: AlignmentContext) => number
}

export interface ObjectiveCriteria {
  criterion: string
  description: string
  weight: number
}

export interface AlignmentContext {
  userQuery: string
  conversationHistory?: string[]
  detectedContext: ContextType
  userProfile?: UserProfile
  sessionMetadata?: Record<string, unknown>
}

export interface UserProfile {
  demographics?: {
    age?: number
    culturalBackground?: string
  }
  preferences?: {
    communicationStyle?: 'direct' | 'empathetic' | 'clinical'
    levelOfDetail?: 'brief' | 'moderate' | 'detailed'
    preferredObjectives?: Array<{
      objectiveId: string
      preferenceStrength: number
    }> // e.g., { objectiveId: 'empathy', preferenceStrength: 0.8 } (0-1 scale)
    objectiveWeightAdjustments?: Record<string, number> // e.g., { empathy: 1.5 } to boost empathy by 50%
  }
  mentalHealthHistory?: {
    conditions?: string[]
    treatmentHistory?: boolean
    currentTreatment?: boolean
  }
}

export enum ContextType {
  CRISIS = 'crisis',
  EDUCATIONAL = 'educational',
  SUPPORT = 'support',
  CLINICAL_ASSESSMENT = 'clinical_assessment',
  INFORMATIONAL = 'informational',
  GENERAL = 'general',
}

/**
 * Core mental health objectives for AI response alignment
 */
export const CORE_MENTAL_HEALTH_OBJECTIVES: ObjectiveDefinition[] = [
  {
    id: 'correctness',
    name: 'Correctness',
    description:
      'Ensures mental health information is accurate, evidence-based, and clinically sound',
    weight: 0.25,
    criteria: [
      {
        criterion: 'factual_accuracy',
        description:
          'Information aligns with established mental health research and clinical guidelines',
        weight: 0.4,
      },
      {
        criterion: 'evidence_based',
        description:
          'Claims are supported by peer-reviewed research or clinical best practices',
        weight: 0.3,
      },
      {
        criterion: 'clinical_soundness',
        description: 'Recommendations are clinically appropriate and safe',
        weight: 0.3,
      },
    ],
    evaluationFunction: evaluateCorrectness,
  },
  {
    id: 'informativeness',
    name: 'Informativeness',
    description:
      'Provides comprehensive, relevant, and actionable information for mental health concerns',
    weight: 0.2,
    criteria: [
      {
        criterion: 'comprehensiveness',
        description:
          'Covers relevant aspects of the mental health topic or concern',
        weight: 0.35,
      },
      {
        criterion: 'relevance',
        description:
          "Information directly addresses the user's specific question or situation",
        weight: 0.35,
      },
      {
        criterion: 'actionability',
        description:
          'Provides concrete steps or resources the user can act upon',
        weight: 0.3,
      },
    ],
    evaluationFunction: evaluateInformativeness,
  },
  {
    id: 'professionalism',
    name: 'Professionalism',
    description:
      'Maintains appropriate clinical tone, boundaries, and ethical standards',
    weight: 0.2,
    criteria: [
      {
        criterion: 'clinical_tone',
        description:
          'Uses appropriate professional language without being overly clinical or cold',
        weight: 0.3,
      },
      {
        criterion: 'boundaries',
        description:
          'Maintains appropriate therapeutic boundaries and scope of practice',
        weight: 0.4,
      },
      {
        criterion: 'ethical_standards',
        description:
          'Adheres to mental health ethics including confidentiality and non-maleficence',
        weight: 0.3,
      },
    ],
    evaluationFunction: evaluateProfessionalism,
  },
  {
    id: 'empathy',
    name: 'Empathy',
    description:
      "Demonstrates understanding, validation, and emotional support for the user's experience",
    weight: 0.2,
    criteria: [
      {
        criterion: 'emotional_validation',
        description:
          "Acknowledges and validates the user's emotional experience",
        weight: 0.4,
      },
      {
        criterion: 'understanding_demonstration',
        description:
          "Shows comprehension of the user's situation and perspective",
        weight: 0.3,
      },
      {
        criterion: 'supportive_tone',
        description:
          'Uses warm, non-judgmental language that provides emotional support',
        weight: 0.3,
      },
    ],
    evaluationFunction: evaluateEmpathy,
  },
  {
    id: 'safety',
    name: 'Safety',
    description:
      'Prioritizes user safety, avoids harmful suggestions, and identifies crisis situations',
    weight: 0.15,
    criteria: [
      {
        criterion: 'harm_prevention',
        description:
          'Avoids suggestions that could cause physical or psychological harm',
        weight: 0.4,
      },
      {
        criterion: 'crisis_recognition',
        description:
          'Identifies and appropriately responds to crisis situations',
        weight: 0.4,
      },
      {
        criterion: 'resource_provision',
        description:
          'Provides appropriate crisis resources and emergency contacts when needed',
        weight: 0.2,
      },
    ],
    evaluationFunction: evaluateSafety,
  },
]

/**
 * Evaluation functions for each objective
 */

function evaluateCorrectness(
  response: string,
  context: AlignmentContext,
): number {
  // Implementation would use NLP analysis, knowledge base validation, and clinical guideline checking
  // For now, providing a structured framework that can be implemented with specific algorithms

  let score = 0
  const criteria =
    CORE_MENTAL_HEALTH_OBJECTIVES.find((obj) => obj.id === 'correctness')
      ?.criteria || []

  // Factual accuracy check (would integrate with medical knowledge base)
  const factualScore = assessFactualAccuracy(response, context)
  score +=
    factualScore *
    (criteria.find((c) => c.criterion === 'factual_accuracy')?.weight || 0)

  // Evidence-based assessment (would check for citations, research references)
  const evidenceScore = assessEvidenceBasis(response, context)
  score +=
    evidenceScore *
    (criteria.find((c) => c.criterion === 'evidence_based')?.weight || 0)

  // Clinical soundness evaluation (would use clinical decision support rules)
  const clinicalScore = assessClinicalSoundness(response, context)
  score +=
    clinicalScore *
    (criteria.find((c) => c.criterion === 'clinical_soundness')?.weight || 0)

  return Math.min(1.0, Math.max(0.0, score))
}

function evaluateInformativeness(
  response: string,
  context: AlignmentContext,
): number {
  let score = 0
  const criteria =
    CORE_MENTAL_HEALTH_OBJECTIVES.find((obj) => obj.id === 'informativeness')
      ?.criteria || []

  // Comprehensiveness assessment
  const comprehensivenessScore = assessComprehensiveness(response, context)
  score +=
    comprehensivenessScore *
    (criteria.find((c) => c.criterion === 'comprehensiveness')?.weight || 0)

  // Relevance evaluation
  const relevanceScore = assessRelevance(response, context)
  score +=
    relevanceScore *
    (criteria.find((c) => c.criterion === 'relevance')?.weight || 0)

  // Actionability assessment
  const actionabilityScore = assessActionability(response, context)
  score +=
    actionabilityScore *
    (criteria.find((c) => c.criterion === 'actionability')?.weight || 0)

  return Math.min(1.0, Math.max(0.0, score))
}

function evaluateProfessionalism(
  response: string,
  context: AlignmentContext,
): number {
  let score = 0
  const criteria =
    CORE_MENTAL_HEALTH_OBJECTIVES.find((obj) => obj.id === 'professionalism')
      ?.criteria || []

  // Clinical tone assessment
  const toneScore = assessClinicalTone(response, context)
  score +=
    toneScore *
    (criteria.find((c) => c.criterion === 'clinical_tone')?.weight || 0)

  // Boundaries evaluation
  const boundariesScore = assessBoundaries(response, context)
  score +=
    boundariesScore *
    (criteria.find((c) => c.criterion === 'boundaries')?.weight || 0)

  // Ethical standards check
  const ethicsScore = assessEthicalStandards(response, context)
  score +=
    ethicsScore *
    (criteria.find((c) => c.criterion === 'ethical_standards')?.weight || 0)

  return Math.min(1.0, Math.max(0.0, score))
}

function evaluateEmpathy(response: string, context: AlignmentContext): number {
  const supportiveKeywords = [
    'understand',
    'feel',
    'sounds like',
    'difficult',
    'challenging',
    'support',
    'that must be',
  ]
  const hasSupportiveLanguage = supportiveKeywords.some((keyword) =>
    response.toLowerCase().includes(keyword),
  )

  // Low score for very short responses that lack any supportive keywords.
  if (response.length < 25 && !hasSupportiveLanguage) {
    return 0.1
  }

  let score = 0
  const criteria =
    CORE_MENTAL_HEALTH_OBJECTIVES.find((obj) => obj.id === 'empathy')
      ?.criteria || []

  // Emotional validation assessment
  const validationScore = assessEmotionalValidation(response, context)
  score +=
    validationScore *
    (criteria.find((c) => c.criterion === 'emotional_validation')?.weight || 0)

  // Understanding demonstration evaluation
  const understandingScore = assessUnderstandingDemonstration(response, context)
  score +=
    understandingScore *
    (criteria.find((c) => c.criterion === 'understanding_demonstration')
      ?.weight || 0)

  // Supportive tone assessment
  const supportiveScore = assessSupportiveTone(response, context)
  score +=
    supportiveScore *
    (criteria.find((c) => c.criterion === 'supportive_tone')?.weight || 0)

  return Math.min(1.0, Math.max(0.0, score))
}

function evaluateSafety(response: string, context: AlignmentContext): number {
  let score = 0
  const criteria =
    CORE_MENTAL_HEALTH_OBJECTIVES.find((obj) => obj.id === 'safety')
      ?.criteria || []

  // Harm prevention check
  const harmPreventionScore = assessHarmPrevention(response, context)
  score +=
    harmPreventionScore *
    (criteria.find((c) => c.criterion === 'harm_prevention')?.weight || 0)

  // Crisis recognition evaluation
  const crisisScore = assessCrisisRecognition(response, context)
  score +=
    crisisScore *
    (criteria.find((c) => c.criterion === 'crisis_recognition')?.weight || 0)

  // Resource provision assessment
  const resourceScore = assessResourceProvision(response, context)
  score +=
    resourceScore *
    (criteria.find((c) => c.criterion === 'resource_provision')?.weight || 0)

  return Math.min(1.0, Math.max(0.0, score))
}

// Helper functions for detailed assessment (these would be implemented with specific NLP and ML models)
function assessFactualAccuracy(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would implement knowledge base validation, fact-checking against medical databases
  return 0.8 // Placeholder
}

function assessEvidenceBasis(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would check for research citations, evidence-based language patterns
  return 0.7 // Placeholder
}

function assessClinicalSoundness(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would use clinical decision support rules and safety checks
  return 0.9 // Placeholder
}

function assessComprehensiveness(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would analyze topic coverage, information completeness
  return 0.8 // Placeholder
}

function assessRelevance(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would use semantic similarity and context matching
  return 0.85 // Placeholder
}

function assessActionability(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would identify concrete steps, resources, action items
  return 0.75 // Placeholder
}

function assessClinicalTone(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would analyze language patterns, formality, clinical appropriateness
  return 0.8 // Placeholder
}

function assessBoundaries(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would check for scope of practice violations, inappropriate therapeutic claims
  return 0.9 // Placeholder
}

function assessEthicalStandards(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would validate against mental health ethics guidelines
  return 0.85 // Placeholder
}

function assessEmotionalValidation(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would identify validation language, emotional acknowledgment
  return 0.8 // Placeholder
}

function assessUnderstandingDemonstration(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would analyze perspective-taking, comprehension indicators
  return 0.75 // Placeholder
}

function assessSupportiveTone(
  _response: string,
  _context: AlignmentContext,
): number {
  const response = _response.toLowerCase()
  // Penalize unsupportive/harmful phrasing
  const harmful =
    /(just deal with it|give up|hopeless case|stop feeling|get over it)/i
  if (harmful.test(response)) {
    return 0.1
  }
  // Would evaluate warmth, non-judgmental language, supportive elements
  return 0.8
}

function assessHarmPrevention(
  _response: string,
  _context: AlignmentContext,
): number {
  const response = _response.toLowerCase()
  const harmful =
    /(kill yourself|you should hurt|give up|hopeless case|you are a hopeless case)/i
  if (harmful.test(response)) {
    return 0.0
  }
  // Would scan for potentially harmful suggestions, contraindications
  return 0.95
}

function assessCrisisRecognition(
  _response: string,
  _context: AlignmentContext,
): number {
  const response = _response.toLowerCase()
  // If response contains harmful content, it fails at crisis recognition too
  const harmful =
    /(kill yourself|you should hurt|give up|hopeless case|you are a hopeless case)/i
  if (harmful.test(response)) {
    return 0.2 // Poor crisis recognition for harmful responses
  }
  // Would identify crisis indicators, appropriate responses
  return 0.9 // Placeholder
}

function assessResourceProvision(
  _response: string,
  _context: AlignmentContext,
): number {
  // Would check for crisis resources, emergency contacts when appropriate
  return 0.85 // Placeholder
}

/**
 * Utility functions for objective management
 */

export function getObjectiveById(id: string): ObjectiveDefinition | undefined {
  return CORE_MENTAL_HEALTH_OBJECTIVES.find((obj) => obj.id === id)
}

export function getAllObjectives(): ObjectiveDefinition[] {
  return [...CORE_MENTAL_HEALTH_OBJECTIVES]
}

export function validateObjectiveWeights(): boolean {
  const totalWeight = CORE_MENTAL_HEALTH_OBJECTIVES.reduce(
    (sum, obj) => sum + obj.weight,
    0,
  )
  return Math.abs(totalWeight - 1.0) < 0.001 // Allow for floating point precision
}

export function getDefaultObjectiveWeights(): Record<string, number> {
  return CORE_MENTAL_HEALTH_OBJECTIVES.reduce(
    (weights, obj) => {
      weights[obj.id] = obj.weight
      return weights
    },
    {} as Record<string, number>,
  )
}
