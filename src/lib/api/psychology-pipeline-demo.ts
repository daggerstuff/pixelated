import { z } from 'zod'
import type { } from '../types/psychology-pipeline'

const Dsm5Schema = z.object({
  'Major Depressive Disorder': z.array(z.string()),
})

const Pdm2Schema = z.object({
  'Personality Patterns': z.array(z.string()),
})

const BigFiveSchema = z.object({
  Traits: z.array(z.string()),
})

// Client Scenario Generator Schemas
const ScenarioGenerationRequestSchema = z.object({
  patientInfo: z.object({
    age: z.number(),
    gender: z.string(),
    occupation: z.string(),
    background: z.string(),
  }),
  presentingProblem: z.string(),
  presentingProblemDevelopment: z.array(
    z.object({
      time: z.string(),
      description: z.string(),
    }),
  ),
  complexity: z.enum(['low', 'medium', 'high']),
  therapeuticApproach: z.array(z.string()),
  culturalFactors: z.array(z.string()).optional(),
})

const ScenarioGenerationResponseSchema = z.object({
  caseId: z.string(),
  patientInfo: z.object({
    age: z.number(),
    gender: z.string(),
    occupation: z.string(),
    background: z.string(),
  }),
  presentingProblem: z.string(),
  presentingProblemDevelopment: z.array(
    z.object({
      time: z.string(),
      description: z.string(),
    }),
  ),
  clinicalFormulation: z.object({
    provisionalDiagnosis: z.array(z.string()),
    contributingFactors: z.object({
      biological: z.array(z.string()),
      psychological: z.array(z.string()),
      social: z.array(z.string()),
    }),
    summary: z.string(),
  }),
  treatmentPlan: z.object({
    goals: z.object({
      shortTerm: z.array(z.string()),
      longTerm: z.array(z.string()),
    }),
    interventions: z.array(z.string()),
    modalities: z.array(z.string()),
    outcomeMeasures: z.array(z.string()),
  }),
  generationMetadata: z.object({
    timestamp: z.string(),
    processingTime: z.number(),
    qualityScore: z.number(),
    balanceScore: z.number(),
  }),
})

export const fetchKnowledgeData = async () => {
  // In a real application, this would fetch from an API endpoint.
  // For this demo, we'll return the static data.
  const dsm5Data = {
    'Major Depressive Disorder': [
      'Depressed mood most of the day, nearly every day.',
      'Markedly diminished interest or pleasure in all, or almost all, activities.',
      'Significant weight loss when not dieting or weight gain.',
      'Insomnia or hypersomnia nearly every day.',
      'Psychomotor agitation or retardation nearly every day.',
      'Fatigue or loss of energy nearly every day.',
      'Feelings of worthlessness or excessive or inappropriate guilt.',
      'Diminished ability to think or concentrate, or indecisiveness.',
      'Recurrent thoughts of death, recurrent suicidal ideation without a specific plan.',
    ],
  }

  const pdm2Data = {
    'Personality Patterns': [
      'Depressive',
      'Anxious',
      'Obsessive-Compulsive',
      'Hysterical (Histrionic)',
      'Narcissistic',
      'Paranoid',
      'Schizoid',
    ],
  }

  const bigFiveData = {
    Traits: [
      'Openness',
      'Conscientiousness',
      'Extraversion',
      'Agreeableness',
      'Neuroticism',
    ],
  }

  return {
    dsm5: Dsm5Schema.parse(dsm5Data),
    pdm2: Pdm2Schema.parse(pdm2Data),
    bigFive: BigFiveSchema.parse(bigFiveData),
  }
}

// Client Scenario Generator API Connection
export const generateClientScenario = async (
  requestData: z.infer<typeof ScenarioGenerationRequestSchema>,
): Promise<z.infer<typeof ScenarioGenerationResponseSchema>> => {
  // Validate input
  const validatedRequest = ScenarioGenerationRequestSchema.parse(requestData)

  // Simulate API call to client scenario generator service
  const startTime = Date.now()

  // In production, this would be:
  // const response = await fetch('/api/psychology-pipeline/generate-scenario', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(validatedRequest)
  // });
  // const data = await response.json();

  // For demo purposes, simulate processing time and generate response
  await new Promise((resolve) =>
    setTimeout(resolve, 1500 + Math.random() * 1000),
  )

  const processingTime = Date.now() - startTime

  // Generate comprehensive clinical case based on input
  const generatedCase: z.infer<typeof ScenarioGenerationResponseSchema> = {
    caseId: `CASE_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    patientInfo: validatedRequest.patientInfo,
    presentingProblem: validatedRequest.presentingProblem,
    presentingProblemDevelopment: validatedRequest.presentingProblemDevelopment,
    clinicalFormulation: generateClinicalFormulation(validatedRequest),
    treatmentPlan: generateTreatmentPlan(validatedRequest),
    generationMetadata: {
      timestamp: new Date().toISOString(),
      processingTime,
      qualityScore: 85 + Math.random() * 10, // Simulate quality score 85-95%
      balanceScore: 78 + Math.random() * 15, // Simulate balance score 78-93%
    },
  }

  return ScenarioGenerationResponseSchema.parse(generatedCase)
}

// Helper function to generate clinical formulation
function generateClinicalFormulation(
  request: z.infer<typeof ScenarioGenerationRequestSchema>,
) {
  const { patientInfo, presentingProblem, complexity } = request
  const problemLower = presentingProblem.toLowerCase()

  // Generate provisional diagnoses
  const diagnoses: string[] = []
  if (problemLower.includes('anxiety')) {
    diagnoses.push('Generalized Anxiety Disorder (300.02)')
    if (problemLower.includes('work') || problemLower.includes('stress')) {
      diagnoses.push('Adjustment Disorder with Anxiety (309.24)')
    }
  } else if (problemLower.includes('depression')) {
    diagnoses.push('Major Depressive Disorder (296.23)')
  } else if (problemLower.includes('trauma')) {
    diagnoses.push('Post-Traumatic Stress Disorder (309.81)')
  } else {
    diagnoses.push(
      'Adjustment Disorder with Mixed Anxiety and Depressed Mood (309.28)',
    )
  }

  if (complexity === 'high') {
    diagnoses.push('Personality Disorder NOS (301.9)')
  }

  // Generate contributing factors
  const contributingFactors = {
    biological: [
      'Possible genetic predisposition',
      ...(patientInfo.age > 50 ? ['Age-related hormonal changes'] : []),
      ...(problemLower.includes('sleep')
        ? ['Sleep disruption affecting neurotransmitter balance']
        : []),
    ],
    psychological: [
      ...(problemLower.includes('anxiety')
        ? ['Catastrophic thinking patterns', 'Low distress tolerance']
        : []),
      ...(problemLower.includes('work')
        ? ['Perfectionist tendencies', 'Fear of failure']
        : []),
      ...(complexity !== 'low' ? ['Maladaptive coping strategies'] : []),
    ],
    social: [
      ...(patientInfo.occupation.toLowerCase().includes('manager')
        ? ['High-pressure work environment']
        : []),
      ...(patientInfo.background.toLowerCase().includes('urban')
        ? ['Urban stressors']
        : []),
      ...(complexity === 'high'
        ? ['Limited social support']
        : ['Generally supportive social network']),
    ],
  }

  // Generate clinical summary
  const summary = `${patientInfo.age}-year-old ${patientInfo.gender} ${patientInfo.occupation.toLowerCase()} presenting with ${presentingProblem.toLowerCase()}. ${complexity === 'low'
    ? 'Symptoms appear situational with good functioning. Favorable prognosis.'
    : complexity === 'medium'
      ? 'Moderate impact on functioning with multiple contributing factors.'
      : 'Complex presentation with significant functional impairment requiring intensive treatment.'
    }`

  return {
    provisionalDiagnosis: diagnoses,
    contributingFactors,
    summary,
  }
}

// Helper function to generate treatment plan
function generateTreatmentPlan(
  request: z.infer<typeof ScenarioGenerationRequestSchema>,
) {
  const { presentingProblem, complexity, therapeuticApproach } = request
  const problemLower = presentingProblem.toLowerCase()

  // Generate goals
  const shortTermGoals: string[] = []
  const longTermGoals: string[] = []

  if (problemLower.includes('anxiety')) {
    shortTermGoals.push('Reduce anxiety symptoms by 40% within 8 weeks')
    shortTermGoals.push('Develop coping strategies for anxiety triggers')
  } else if (problemLower.includes('depression')) {
    shortTermGoals.push('Improve mood stability within 6-8 weeks')
    shortTermGoals.push('Increase daily activity engagement')
  }

  shortTermGoals.push('Establish therapeutic rapport and treatment engagement')

  longTermGoals.push('Maintain stable mood and symptom management')
  longTermGoals.push('Develop resilience for future stressors')
  longTermGoals.push('Improve overall quality of life and functioning')

  // Generate interventions based on therapeutic approaches
  const interventions: string[] = []
  therapeuticApproach.forEach((approach) => {
    switch (approach) {
      case 'CBT':
        interventions.push(
          'Cognitive restructuring for negative thought patterns',
        )
        interventions.push('Behavioral activation and exposure exercises')
        break
      case 'DBT':
        interventions.push('Distress tolerance skills training')
        interventions.push('Emotion regulation techniques')
        break
      case 'Mindfulness':
        interventions.push('Mindfulness-based stress reduction')
        interventions.push('Present-moment awareness exercises')
        break
      case 'EMDR':
        interventions.push('Trauma processing through bilateral stimulation')
        break
      default:
        interventions.push(`${approach}-based therapeutic interventions`)
    }
  })

  if (complexity === 'high') {
    interventions.push('Crisis intervention and safety planning')
  }

  // Generate outcome measures
  const outcomeMeasures: string[] = []
  if (problemLower.includes('anxiety')) {
    outcomeMeasures.push('GAD-7 (Generalized Anxiety Disorder Scale)')
    outcomeMeasures.push('Beck Anxiety Inventory')
  } else if (problemLower.includes('depression')) {
    outcomeMeasures.push('PHQ-9 (Patient Health Questionnaire)')
    outcomeMeasures.push('Beck Depression Inventory')
  }

  outcomeMeasures.push('Work and Social Adjustment Scale')
  outcomeMeasures.push('Quality of Life Scale')

  return {
    goals: {
      shortTerm: shortTermGoals,
      longTerm: longTermGoals,
    },
    interventions,
    modalities: therapeuticApproach,
    outcomeMeasures,
  }
}

// Batch scenario generation for training datasets
export const generateScenarioBatch = async (
  requests: z.infer<typeof ScenarioGenerationRequestSchema>[],
  options?: {
    balanceTargets?: Record<string, number>
    qualityThreshold?: number
    maxRetries?: number
  },
): Promise<{
  scenarios: z.infer<typeof ScenarioGenerationResponseSchema>[]
  batchMetadata: {
    totalGenerated: number
    averageQualityScore: number
    averageBalanceScore: number
    processingTime: number
    balanceAchieved: boolean
  }
}> => {
  const startTime = Date.now()
  const scenarios: z.infer<typeof ScenarioGenerationResponseSchema>[] = []

  // Process each request
  for (const request of requests) {
    const scenario = await generateClientScenario(request)
    scenarios.push(scenario)
  }

  const processingTime = Date.now() - startTime
  const averageQualityScore =
    scenarios.reduce((sum, s) => sum + s.generationMetadata.qualityScore, 0) /
    scenarios.length
  const averageBalanceScore =
    scenarios.reduce((sum, s) => sum + s.generationMetadata.balanceScore, 0) /
    scenarios.length

  return {
    scenarios,
    batchMetadata: {
      totalGenerated: scenarios.length,
      averageQualityScore,
      averageBalanceScore,
      processingTime,
      balanceAchieved: averageBalanceScore >= (options?.qualityThreshold || 80),
    },
  }
}

// Conversation Converter API Integration (Task 5.4)
const ConversationConverterRequestSchema = z.object({
  knowledgeBase: z.object({
    dsm5Criteria: z.array(z.string()),
    therapeuticTechniques: z.array(z.string()),
    clinicalGuidelines: z.array(z.string()),
  }),
  clientProfile: z.object({
    demographics: z.object({
      age: z.number(),
      gender: z.string(),
      background: z.string(),
    }),
    presentingProblem: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    riskFactors: z.array(z.string()),
  }),
  conversationParameters: z.object({
    therapeuticApproach: z.string(),
    sessionLength: z.number(),
    targetTechniques: z.array(z.string()),
    qualityThreshold: z.number().min(0).max(100),
  }),
})

const ConversationConverterResponseSchema = z.object({
  conversationId: z.string(),
  generatedDialogue: z.array(
    z.object({
      speaker: z.enum(['therapist', 'client']),
      content: z.string(),
      timestamp: z.string(),
      techniques: z.array(z.string()),
      emotionalState: z.string().optional(),
      interventionType: z.string().optional(),
      knowledgeSource: z.object({
        type: z.string(),
        reference: z.string(),
        confidence: z.number(),
      }),
    }),
  ),
  qualityMetrics: z.object({
    overallScore: z.number(),
    authenticity: z.number(),
    therapeuticAccuracy: z.number(),
    knowledgeIntegration: z.number(),
    conversationFlow: z.number(),
  }),
  knowledgeMapping: z.array(
    z.object({
      dialogueTurn: z.number(),
      appliedKnowledge: z.array(
        z.object({
          source: z.string(),
          content: z.string(),
          application: z.string(),
          confidence: z.number(),
        }),
      ),
    }),
  ),
  conversionMetadata: z.object({
    processingTime: z.number(),
    knowledgeSourcesUsed: z.number(),
    techniquesCovered: z.array(z.string()),
    qualityValidated: z.boolean(),
    timestamp: z.string(),
  }),
})

// Conversation Converter API Function
export const convertKnowledgeToConversation = async (
  requestData: z.infer<typeof ConversationConverterRequestSchema>,
): Promise<z.infer<typeof ConversationConverterResponseSchema>> => {
  // Validate input
  const validatedRequest = ConversationConverterRequestSchema.parse(requestData)

  const startTime = Date.now()

  // Simulate knowledge-to-conversation conversion process
  await new Promise((resolve) =>
    setTimeout(resolve, 2000 + Math.random() * 1000),
  )

  const processingTime = Date.now() - startTime

  // Generate conversation based on knowledge base and client profile
  const generatedDialogue = generateKnowledgeBasedDialogue(validatedRequest)

  // Calculate quality metrics
  const qualityMetrics = calculateConversationQuality(validatedRequest)

  // Map knowledge sources to dialogue turns
  const knowledgeMapping = mapKnowledgeToDialogue(generatedDialogue)

  const response: z.infer<typeof ConversationConverterResponseSchema> = {
    conversationId: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    generatedDialogue,
    qualityMetrics,
    knowledgeMapping,
    conversionMetadata: {
      processingTime,
      knowledgeSourcesUsed:
        validatedRequest.knowledgeBase.dsm5Criteria.length +
        validatedRequest.knowledgeBase.therapeuticTechniques.length +
        validatedRequest.knowledgeBase.clinicalGuidelines.length,
      techniquesCovered:
        validatedRequest.conversationParameters.targetTechniques,
      qualityValidated:
        qualityMetrics.overallScore >=
        validatedRequest.conversationParameters.qualityThreshold,
      timestamp: new Date().toISOString(),
    },
  }

  return ConversationConverterResponseSchema.parse(response)
}

// Helper function to generate knowledge-based dialogue
function generateKnowledgeBasedDialogue(
  request: z.infer<typeof ConversationConverterRequestSchema>,
) {
  const { clientProfile, conversationParameters, knowledgeBase } = request
  const dialogue = []

  // Opening therapist response based on approach and knowledge
  dialogue.push({
    speaker: 'therapist' as const,
    content: generateKnowledgeBasedOpening(
      conversationParameters.therapeuticApproach,
    ),
    timestamp: new Date().toISOString(),
    techniques: ['rapport_building', 'assessment'],
    interventionType: 'initial_assessment',
    knowledgeSource: {
      type: 'clinical_guidelines',
      reference: 'Therapeutic engagement best practices',
      confidence: 0.95,
    },
  })

  // Client response based on profile
  dialogue.push({
    speaker: 'client' as const,
    content: generateClientResponse(clientProfile),
    timestamp: new Date().toISOString(),
    techniques: [],
    emotionalState:
      clientProfile.severity === 'high'
        ? 'distressed'
        : clientProfile.severity === 'medium'
          ? 'concerned'
          : 'hopeful',
    knowledgeSource: {
      type: 'client_profile',
      reference: 'Presenting problem and demographics',
      confidence: 0.9,
    },
  })

  // Therapist intervention based on DSM-5 and techniques
  dialogue.push({
    speaker: 'therapist' as const,
    content: generateKnowledgeBasedIntervention(
      conversationParameters.therapeuticApproach,
      knowledgeBase.dsm5Criteria,
      knowledgeBase.therapeuticTechniques,
      clientProfile.presentingProblem,
    ),
    timestamp: new Date().toISOString(),
    techniques: conversationParameters.targetTechniques.slice(0, 2),
    interventionType: 'therapeutic_intervention',
    knowledgeSource: {
      type: 'dsm5_therapeutic_techniques',
      reference: 'Evidence-based intervention protocols',
      confidence: 0.88,
    },
  })

  // Client processing response
  dialogue.push({
    speaker: 'client' as const,
    content: generateClientProcessingResponse(
      clientProfile,
      conversationParameters.therapeuticApproach,
    ),
    timestamp: new Date().toISOString(),
    techniques: [],
    emotionalState: 'reflective',
    knowledgeSource: {
      type: 'therapeutic_response_patterns',
      reference: 'Client engagement and processing indicators',
      confidence: 0.85,
    },
  })

  // Follow-up therapist response
  dialogue.push({
    speaker: 'therapist' as const,
    content: generateKnowledgeBasedFollowUp(
      conversationParameters.therapeuticApproach,
    ),
    timestamp: new Date().toISOString(),
    techniques: conversationParameters.targetTechniques.slice(2, 4),
    interventionType: 'skill_building',
    knowledgeSource: {
      type: 'clinical_guidelines',
      reference: 'Progressive intervention strategies',
      confidence: 0.92,
    },
  })

  return dialogue
}

interface KnowledgeBase {
  dsm5?: string[]
  techniques?: string[]
  research?: string[]
  guidelines?: string[]
  contraindications?: string[]
  [key: string]: unknown
}

interface ClientProfile {
  name?: string
  age?: number
  gender?: string
  background?: string
  presentingProblem?: string
  history?: string
  symptoms?: string[]
  diagnosis?: string
  severity?: string
  [key: string]: unknown
}

interface DialogueEntry {
  role: 'therapist' | 'client'
  content: string
  timestamp?: string
  emotions?: string[]
  techniques?: string[]
  [key: string]: unknown
}

function generateKnowledgeBasedOpening(approach: string): string {
  const openings = {
    CBT: "I'd like to understand what's been challenging for you lately. Our work together will focus on examining the connections between your thoughts, feelings, and behaviors to help you develop more effective coping strategies.",
    DBT: "Thank you for being here. I want to create a space where you can share what's been difficult while we work on building skills to help you manage intense emotions and improve your relationships.",
    Psychodynamic:
      "I'm interested in hearing about what brings you here today. We'll explore not just what's happening now, but also how your past experiences might be influencing your current struggles.",
    Humanistic:
      "This is your space to share whatever feels most important to you right now. I'm here to support you in exploring your experiences and finding your own path forward.",
    EMDR: "I appreciate you taking this step. We'll work together to help you process difficult experiences in a way that reduces their emotional impact and helps you feel more in control.",
  }
  return openings[approach as keyof typeof openings] || openings['CBT']
}

function generateClientResponse(profile: ClientProfile): string {
  const responses = {
    low: `I've been dealing with ${profile.presentingProblem?.toLowerCase()}, and while it's manageable most days, I'd like to develop better ways to handle it.`,
    medium: `${profile.presentingProblem} has been really affecting my daily life. Some days are better than others, but I'm finding it harder to cope lately.`,
    high: `I'm really struggling with ${profile.presentingProblem.toLowerCase()}. It feels overwhelming most of the time, and I'm not sure how to manage it anymore.`,
  }
  return (
    responses[profile.severity as keyof typeof responses] || responses['medium']
  )
}

function generateKnowledgeBasedIntervention(
  approach: string,
  dsm5: string[],
  techniques: string[],
  problem: string,
): string {
  const interventions = {
    CBT: `I can hear how much this is impacting you. Let's start by exploring the thoughts that tend to go through your mind when you're experiencing ${problem.toLowerCase()}. Often, our automatic thoughts can intensify our emotional responses, and by identifying these patterns, we can work on developing more balanced perspectives.`,
    DBT: `It sounds like you're experiencing significant distress. Let's work on some concrete skills that can help you manage these intense feelings. We'll start with distress tolerance techniques - ways to get through crisis moments without making things worse - and then build up your emotional regulation skills.`,
    Psychodynamic: `Your experience with ${problem.toLowerCase()} may connect to deeper patterns in how you relate to yourself and others. I'm curious about what this struggle reminds you of from earlier in your life, and how those experiences might be influencing what you're going through now.`,
    Humanistic: `I can really hear the pain in what you're sharing about ${problem.toLowerCase()}. Your feelings and experiences are completely valid. What would it mean for you to have more compassion for yourself as you navigate this challenge?`,
    EMDR: `When you think about ${problem.toLowerCase()}, what images, sensations, or memories come up for you? We'll work on processing these experiences so they have less power over your daily life.`,
  }
  return (
    interventions[approach as keyof typeof interventions] ||
    interventions['CBT']
  )
}

function generateClientProcessingResponse(
  profile: ClientProfile,
  approach: string,
): string {
  const responses = {
    CBT: 'I never really thought about my thoughts that way before. I guess I do have a lot of negative thinking patterns that just seem automatic.',
    DBT: "That makes sense. I do feel like I get overwhelmed and then don't know what to do with all these intense feelings.",
    Psychodynamic:
      "Hmm, that's interesting. This does remind me of some things from my past that I hadn't connected before.",
    Humanistic:
      "It feels both scary and relieving to acknowledge this out loud. I've been so hard on myself about it.",
    EMDR: 'When I think about it, I do get these physical sensations and sometimes images flash through my mind.',
  }
  return responses[approach as keyof typeof responses] || responses['CBT']
}

function generateKnowledgeBasedFollowUp(approach: string): string {
  const followUps = {
    CBT: "That's a great insight. Let's practice identifying these thought patterns together. I'll teach you some techniques for examining the evidence for your thoughts and developing more balanced alternatives.",
    DBT: "I'm glad that resonates with you. Let's start with a specific skill you can use right away. When you notice intense emotions building, try the TIPP technique to help regulate your nervous system.",
    Psychodynamic:
      "These connections you're making are really important. Let's continue exploring these patterns and how they show up in different areas of your life.",
    Humanistic:
      'Your willingness to be vulnerable here shows real courage. How does it feel to give yourself permission to acknowledge your struggles without judgment?',
    EMDR: "That body awareness is valuable information. Before we process difficult memories, let's establish some resources and coping skills to help you feel more grounded.",
  }
  return followUps[approach as keyof typeof followUps] || followUps['CBT']
}

interface ConversationRequest {
  clientProfile: ClientProfile
  therapeuticApproach: string
  knowledgeBase: KnowledgeBase
  sessionGoals?: string[]
  [key: string]: unknown
}

function calculateConversationQuality(request: ConversationRequest): void {
  // Simulate quality calculation based on knowledge integration
  const baseScore = 80
  const knowledgeIntegration = Math.min(
    95,
    baseScore + request.knowledgeBase.dsm5Criteria.length * 2,
  )
  const therapeuticAccuracy = Math.min(
    92,
    baseScore + request.conversationParameters.targetTechniques.length * 3,
  )
  const authenticity = Math.min(88, baseScore + Math.random() * 10)
  const conversationFlow = Math.min(90, baseScore + 5)

  const overallScore =
    (knowledgeIntegration +
      therapeuticAccuracy +
      authenticity +
      conversationFlow) /
    4

  return {
    overallScore: Math.round(overallScore),
    authenticity: Math.round(authenticity),
    therapeuticAccuracy: Math.round(therapeuticAccuracy),
    knowledgeIntegration: Math.round(knowledgeIntegration),
    conversationFlow: Math.round(conversationFlow),
  }
}

function mapKnowledgeToDialogue(dialogue: DialogueEntry[]): void {
  return dialogue.map((turn, index) => ({
    dialogueTurn: index + 1,
    appliedKnowledge: [
      {
        source: turn.knowledgeSource.type,
        content: turn.knowledgeSource.reference,
        application:
          turn.speaker === 'therapist'
            ? 'therapeutic_intervention'
            : 'client_response_pattern',
        confidence: turn.knowledgeSource.confidence,
      },
    ],
  }))
}

// Export types for conversation converter
export type ConversationConverterRequest = z.infer<
  typeof ConversationConverterRequestSchema
>
export type ConversationConverterResponse = z.infer<
  typeof ConversationConverterResponseSchema
>
