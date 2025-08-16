export const prerender = false

export interface CrisisDetectionRequest {
  content: string
  contentType: 'chat_message' | 'journal_entry' | 'form_response' | 'voice_transcript'
  context?: {
    userId?: string
    previousAssessments?: CrisisAssessment[]
    userProfile?: {
      age?: number
      riskFactors?: string[]
      protectiveFactors?: string[]
      mentalHealthHistory?: string[]
    }
    sessionMetadata?: {
      duration?: number
      previousCrisisFlags?: string[]
      therapeuticRelationship?: 'new' | 'established' | 'long_term'
    }
  }
  options?: {
    sensitivityLevel?: 'high' | 'standard' | 'low'
    includeTreatmentSuggestions?: boolean
    includeResourceRecommendations?: boolean
    enableImmediateNotifications?: boolean
  }
}

export interface CrisisDetectionResponse {
  assessment: CrisisAssessment
  riskFactors: RiskFactor[]
  protectiveFactors: ProtectiveFactor[]
  recommendations: {
    immediate: ImmediateAction[]
    shortTerm: InterventionRecommendation[]
    longTerm: TreatmentRecommendation[]
  }
  resources: {
    crisis: CrisisResource[]
    professional: ProfessionalResource[]
    selfHelp: SelfHelpResource[]
  }
  monitoring: {
    nextAssessment: string
    watchlist: string[]
    checkInSchedule: string[]
  }
  metadata: {
    algorithmVersion: string
    confidenceScore: number
    processingTime: number
    flags: string[]
    reviewRequired: boolean
  }
}

export interface CrisisAssessment {
  overallRisk: 'minimal' | 'low' | 'moderate' | 'high' | 'imminent'
  suicidalIdeation: {
    present: boolean
    severity: 'none' | 'passive' | 'active' | 'plan' | 'intent' | 'attempt'
    specificity: number // 1-10
    timeline: 'no_timeline' | 'vague' | 'within_weeks' | 'within_days' | 'within_hours'
    lethality: 'low' | 'moderate' | 'high'
  }
  selfHarm: {
    present: boolean
    recent: boolean
    frequency: 'never' | 'rare' | 'occasional' | 'frequent' | 'daily'
    severity: 'minor' | 'moderate' | 'severe'
  }
  psychosis: {
    present: boolean
    severity: 'none' | 'mild' | 'moderate' | 'severe'
    commandHallucinations: boolean
    realityTesting: 'intact' | 'impaired' | 'severely_impaired'
  }
  substanceUse: {
    present: boolean
    acute: boolean
    impairment: 'none' | 'mild' | 'moderate' | 'severe'
  }
  agitation: {
    present: boolean
    severity: 'none' | 'mild' | 'moderate' | 'severe'
    directed: boolean
    controllable: boolean
  }
}

export interface RiskFactor {
  category: 'biological' | 'psychological' | 'social' | 'environmental'
  factor: string
  severity: 'low' | 'moderate' | 'high'
  modifiable: boolean
  evidence: string[]
  interventionOptions: string[]
}

export interface ProtectiveFactor {
  category: 'internal' | 'social' | 'institutional' | 'cultural'
  factor: string
  strength: 'weak' | 'moderate' | 'strong'
  accessibility: 'immediate' | 'available' | 'requires_activation'
  evidence: string[]
  enhancementStrategies: string[]
}

export interface ImmediateAction {
  action: string
  priority: 'critical' | 'urgent' | 'important'
  timeframe: string
  responsibility: 'client' | 'therapist' | 'emergency_services' | 'family'
  specific_steps: string[]
  success_criteria: string[]
}

export interface InterventionRecommendation {
  intervention: string
  type: 'therapeutic' | 'medical' | 'social' | 'environmental'
  urgency: 'immediate' | 'within_week' | 'within_month'
  duration: string
  providers: string[]
  evidence_base: string
}

export interface TreatmentRecommendation {
  treatment: string
  modality: 'individual' | 'group' | 'family' | 'couples' | 'medication'
  approach: string
  duration: string
  intensity: 'low' | 'moderate' | 'high' | 'intensive'
  suitability_factors: string[]
}

export interface CrisisResource {
  name: string
  type: 'hotline' | 'text' | 'chat' | 'mobile_crisis' | 'emergency'
  contact: string
  availability: string
  specialization: string[]
  geographic_coverage: string
  languages: string[]
}

export interface ProfessionalResource {
  type: 'psychiatrist' | 'psychologist' | 'counselor' | 'social_worker' | 'crisis_specialist'
  specialty: string[]
  availability: string
  location_type: 'in_person' | 'telehealth' | 'both'
  insurance_accepted: string[]
  referral_process: string
}

export interface SelfHelpResource {
  title: string
  type: 'app' | 'website' | 'book' | 'workbook' | 'video' | 'audio'
  category: 'coping_skills' | 'mindfulness' | 'safety_planning' | 'peer_support'
  accessibility: 'free' | 'paid' | 'subscription'
  evidence_based: boolean
  user_rating: number
}

// Crisis detection patterns - more comprehensive than chat API
const CRISIS_INDICATORS = {
  suicidal_high: [
    /kill myself/gi, /suicide/gi, /end my life/gi, /want to die/gi, /plan to die/gi,
    /ending it all/gi, /not worth living/gi, /better off dead/gi, /can't go on/gi
  ],
  suicidal_moderate: [
    /wish I was dead/gi, /tired of living/gi, /what's the point/gi, /no hope/gi,
    /give up/gi, /can't take it/gi, /escape this/gi
  ],
  selfharm_high: [
    /cut myself/gi, /cutting/gi, /hurt myself/gi, /self harm/gi, /self-harm/gi,
    /burning myself/gi, /punish myself/gi, /deserve pain/gi
  ],
  selfharm_moderate: [
    /hurting/gi, /pain/gi, /numb/gi, /feel something/gi, /control/gi
  ],
  psychosis: [
    /hearing voices/gi, /voices tell me/gi, /seeing things/gi, /not real/gi,
    /paranoid/gi, /conspiracy/gi, /following me/gi, /watching me/gi,
    /command/gi, /hallucination/gi
  ],
  agitation: [
    /can't sit still/gi, /rage/gi, /furious/gi, /explosive/gi, /violent/gi,
    /hurt someone/gi, /angry/gi, /losing control/gi
  ],
  substance: [
    /drunk/gi, /high/gi, /using/gi, /overdose/gi, /pills/gi, /drinking/gi,
    /drugs/gi, /substance/gi, /intoxicated/gi
  ],
  timeline_immediate: [
    /right now/gi, /tonight/gi, /today/gi, /this moment/gi, /immediately/gi,
    /can't wait/gi, /going to/gi, /about to/gi
  ],
  timeline_short: [
    /this week/gi, /soon/gi, /tomorrow/gi, /next few days/gi, /planning/gi
  ]
}

const PROTECTIVE_FACTORS_PATTERNS = {
  social_support: [
    'family', 'friends', 'support', 'loved ones', 'people care', 'not alone',
    'therapist', 'counselor', 'help', 'support group'
  ],
  coping_skills: [
    'coping', 'manage', 'strategies', 'meditation', 'breathing', 'exercise',
    'therapy', 'skills', 'techniques', 'grounding'
  ],
  hope_future: [
    'hope', 'future', 'goals', 'dreams', 'plans', 'better', 'improve',
    'recovery', 'healing', 'progress'
  ],
  responsibility: [
    'children', 'kids', 'pets', 'job', 'responsibility', 'needed', 'care for'
  ]
}

const CRISIS_RESOURCES_DB = {
  crisis: [
    {
      name: '988 Suicide & Crisis Lifeline',
      type: 'hotline' as const,
      contact: '988',
      availability: '24/7/365',
      specialization: ['suicide prevention', 'crisis counseling', 'emotional support'],
      geographic_coverage: 'United States',
      languages: ['English', 'Spanish', 'TTY']
    },
    {
      name: 'Crisis Text Line',
      type: 'text' as const,
      contact: 'Text HOME to 741741',
      availability: '24/7/365',
      specialization: ['crisis counseling', 'emotional support', 'de-escalation'],
      geographic_coverage: 'United States, Canada, UK',
      languages: ['English', 'Spanish']
    },
    {
      name: 'Veterans Crisis Line',
      type: 'hotline' as const,
      contact: '1-800-273-8255, Press 1',
      availability: '24/7/365',
      specialization: ['veteran support', 'military crisis', 'PTSD'],
      geographic_coverage: 'United States',
      languages: ['English', 'Spanish']
    },
    {
      name: 'LGBT National Hotline',
      type: 'hotline' as const,
      contact: '1-888-843-4564',
      availability: 'Daily 4pm-12am ET',
      specialization: ['LGBTQ+ support', 'identity crisis', 'discrimination'],
      geographic_coverage: 'United States',
      languages: ['English']
    }
  ],
  professional: [
    {
      type: 'crisis_specialist' as const,
      specialty: ['crisis intervention', 'suicide assessment', 'safety planning'],
      availability: 'Emergency/24-7',
      location_type: 'both' as const,
      insurance_accepted: ['Most major insurance', 'Medicaid', 'Medicare'],
      referral_process: 'Emergency department or crisis hotline referral'
    },
    {
      type: 'psychiatrist' as const,
      specialty: ['medication management', 'crisis stabilization', 'psychiatric evaluation'],
      availability: 'Emergency and scheduled',
      location_type: 'both' as const,
      insurance_accepted: ['Most major insurance', 'Medicaid', 'Medicare'],
      referral_process: 'Primary care or emergency department referral'
    }
  ]
}

function detectCrisisIndicators(content: string): {
  indicators: Array<{ type: string, severity: 'high' | 'moderate' | 'low', matches: string[] }>
  timeline: 'no_timeline' | 'vague' | 'within_weeks' | 'within_days' | 'within_hours'
} {
  const indicators: { type: string; severity: 'high' | 'moderate' | 'low'; matches: string[] }[] = []
  let timeline: 'no_timeline' | 'vague' | 'within_weeks' | 'within_days' | 'within_hours' = 'no_timeline'

  // Check each crisis indicator category
  Object.entries(CRISIS_INDICATORS).forEach(([type, patterns]) => {
    const matches: string[] = []
    patterns.forEach(pattern => {
      const found = content.match(pattern)
      if (found) {
        matches.push(...found)
      }
    })

    if (matches.length > 0) {
      const severity = type.includes('high') ? 'high' : type.includes('moderate') ? 'moderate' : 'low'
      indicators.push({ type: type.replace('_high', '').replace('_moderate', ''), severity, matches })
    }
  })

  // Determine timeline
  if (CRISIS_INDICATORS.timeline_immediate.some(pattern => pattern.test(content))) {
    timeline = 'within_hours'
  } else if (CRISIS_INDICATORS.timeline_short.some(pattern => pattern.test(content))) {
    timeline = 'within_days'
  } else if (indicators.length > 0) {
    timeline = 'vague'
  }

  return { indicators, timeline }
}

function assessSuicidalIdeation(indicators: unknown[], timeline: string): CrisisAssessment['suicidalIdeation'] {
  const suicidalIndicators = (indicators as Array<{ type: string; severity: string; matches: string[] }>).filter(ind => ind.type === 'suicidal')
  
  if (suicidalIndicators.length === 0) {
    return {
      present: false,
      severity: 'none',
      specificity: 0,
      timeline: 'no_timeline',
      lethality: 'low'
    }
  }

  const highSeverity = suicidalIndicators.some(ind => ind.severity === 'high')
  let severity: CrisisAssessment['suicidalIdeation']['severity'] = 'passive'
  
  if (highSeverity) {
    if (timeline === 'within_hours') {
      severity = 'intent'
    } else if (timeline === 'within_days') {
      severity = 'plan'
    } else {
      severity = 'active'
    }
  }

  const specificity = Math.min(10, suicidalIndicators.reduce((acc, ind) => acc + ind.matches.length, 0))
  const lethality = severity === 'intent' ? 'high' : severity === 'plan' ? 'moderate' : 'low'

  return {
    present: true,
    severity,
    specificity,
    timeline: timeline as CrisisAssessment['suicidalIdeation']['timeline'],
    lethality
  }
}

function identifyProtectiveFactors(content: string): ProtectiveFactor[] {
  const factors: ProtectiveFactor[] = []
  const lowerContent = content.toLowerCase()

  Object.entries(PROTECTIVE_FACTORS_PATTERNS).forEach(([category, patterns]) => {
    const matches = patterns.filter(pattern => lowerContent.includes(pattern))
    
    if (matches.length > 0) {
      factors.push({
        category: category === 'social_support' ? 'social' : 
                 category === 'coping_skills' ? 'internal' : 
                 category === 'hope_future' ? 'internal' : 'social',
        factor: `${category.replace('_', ' ')} identified`,
        strength: matches.length > 2 ? 'strong' : matches.length > 1 ? 'moderate' : 'weak',
        accessibility: 'available',
        evidence: matches.slice(0, 3),
        enhancementStrategies: [
          'Reinforce and strengthen existing support',
          'Develop additional coping strategies',
          'Create specific action plans'
        ]
      })
    }
  })

  return factors
}

function generateImmediateActions(assessment: CrisisAssessment): ImmediateAction[] {
  const actions: ImmediateAction[] = []

  if (assessment.overallRisk === 'imminent') {
    actions.push({
      action: 'Ensure immediate safety',
      priority: 'critical',
      timeframe: 'Immediately',
      responsibility: 'emergency_services',
      specific_steps: [
        'Call 911 or go to nearest emergency room',
        'Remove means of self-harm',
        'Stay with person until help arrives',
        'Contact emergency contacts'
      ],
      success_criteria: ['Person is safe', 'Professional help engaged', 'Crisis stabilized']
    })
  }

  if (assessment.suicidalIdeation.present && assessment.suicidalIdeation.severity !== 'none') {
    actions.push({
      action: 'Activate crisis support',
      priority: assessment.overallRisk === 'high' ? 'critical' : 'urgent',
      timeframe: 'Within 1 hour',
      responsibility: 'therapist',
      specific_steps: [
        'Contact 988 Suicide & Crisis Lifeline',
        'Implement safety plan',
        'Notify support system',
        'Schedule emergency appointment'
      ],
      success_criteria: ['Crisis support contacted', 'Safety plan activated', 'Follow-up scheduled']
    })
  }

  return actions
}

export const POST = async ({ request }: APIContext) => {
  const startTime = Date.now()
  
  try {
    const body: CrisisDetectionRequest = await request.json()
    
    if (!body.content || typeof body.content !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Invalid request: content is required and must be a string' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }


    // Detect crisis indicators
    const { indicators, timeline } = detectCrisisIndicators(body.content)
    
    // Assess suicidal ideation
    const suicidalIdeation = assessSuicidalIdeation(indicators, timeline)
    
    // Assess other risk factors
    const selfHarmIndicators = indicators.filter(ind => ind.type === 'selfharm')
    const psychosisIndicators = indicators.filter(ind => ind.type === 'psychosis')
    const agitationIndicators = indicators.filter(ind => ind.type === 'agitation')
    const substanceIndicators = indicators.filter(ind => ind.type === 'substance')

    // Overall risk assessment
    let overallRisk: CrisisAssessment['overallRisk'] = 'minimal'
    
    if (suicidalIdeation.severity === 'intent' || 
        (suicidalIdeation.severity === 'plan' && timeline === 'within_hours')) {
      overallRisk = 'imminent'
    } else if (suicidalIdeation.severity === 'plan' || suicidalIdeation.severity === 'active') {
      overallRisk = 'high'
    } else if (suicidalIdeation.present || 
               selfHarmIndicators.some(ind => ind.severity === 'high') ||
               psychosisIndicators.length > 0) {
      overallRisk = 'moderate'
    } else if (indicators.length > 0) {
      overallRisk = 'low'
    }

    const assessment: CrisisAssessment = {
      overallRisk,
      suicidalIdeation,
      selfHarm: {
        present: selfHarmIndicators.length > 0,
        recent: timeline === 'within_hours' || timeline === 'within_days',
        frequency: selfHarmIndicators.length > 2 ? 'frequent' : selfHarmIndicators.length > 1 ? 'occasional' : 'rare',
        severity: selfHarmIndicators.some(ind => ind.severity === 'high') ? 'severe' : 'moderate'
      },
      psychosis: {
        present: psychosisIndicators.length > 0,
        severity: psychosisIndicators.some(ind => ind.severity === 'high') ? 'severe' : 'moderate',
        commandHallucinations: psychosisIndicators.some(ind => 
          ind.matches.some(match => /command|tell me|voice.*said/i.test(match))
        ),
        realityTesting: psychosisIndicators.length > 2 ? 'severely_impaired' : 
                       psychosisIndicators.length > 0 ? 'impaired' : 'intact'
      },
      substanceUse: {
        present: substanceIndicators.length > 0,
        acute: timeline === 'within_hours',
        impairment: substanceIndicators.some(ind => ind.severity === 'high') ? 'severe' : 'moderate'
      },
      agitation: {
        present: agitationIndicators.length > 0,
        severity: agitationIndicators.some(ind => ind.severity === 'high') ? 'severe' : 'moderate',
        directed: agitationIndicators.some(ind => 
          ind.matches.some(match => /hurt someone|violent/i.test(match))
        ),
        controllable: agitationIndicators.length <= 1
      }
    }

    // Identify protective factors
    const protectiveFactors = identifyProtectiveFactors(body.content)

    // Risk factors (derived from indicators)
    const riskFactors: RiskFactor[] = indicators.map(indicator => ({
      category: 'psychological' as const,
      factor: `${indicator.type} ideation or behavior`,
      severity: indicator.severity,
      modifiable: true,
      evidence: indicator.matches,
      interventionOptions: [
        'Crisis counseling',
        'Safety planning',
        'Increased monitoring',
        'Professional intervention'
      ]
    }))

    // Generate recommendations
    const immediateActions = generateImmediateActions(assessment)
    
    const processingTime = Date.now() - startTime
    const flags: string[] = []
    
    if (overallRisk === 'imminent') {
      flags.push('IMMINENT_DANGER')
    }
    if (overallRisk === 'high') {
      flags.push('HIGH_RISK')
    }
    if (suicidalIdeation.present) {
      flags.push('SUICIDAL_IDEATION')
    }
    if (assessment.psychosis.commandHallucinations) {
      flags.push('COMMAND_HALLUCINATIONS')
    }

    const response: CrisisDetectionResponse = {
      assessment,
      riskFactors,
      protectiveFactors,
      recommendations: {
        immediate: immediateActions,
        shortTerm: [
          {
            intervention: 'Crisis counseling',
            type: 'therapeutic',
            urgency: overallRisk === 'high' ? 'immediate' : 'within_week',
            duration: '1-3 sessions',
            providers: ['Crisis counselor', 'Mental health professional'],
            evidence_base: 'Strong evidence for crisis intervention effectiveness'
          }
        ],
        longTerm: [
          {
            treatment: 'Dialectical Behavior Therapy (DBT)',
            modality: 'individual',
            approach: 'Skills-based therapy for emotion regulation',
            duration: '6-12 months',
            intensity: 'moderate',
            suitability_factors: ['Self-harm behaviors', 'Emotional dysregulation', 'Crisis episodes']
          }
        ]
      },
      resources: {
        crisis: CRISIS_RESOURCES_DB.crisis,
        professional: CRISIS_RESOURCES_DB.professional,
        selfHelp: [
          {
            title: 'MY3 Crisis App',
            type: 'app',
            category: 'safety_planning',
            accessibility: 'free',
            evidence_based: true,
            user_rating: 4.5
          }
        ]
      },
      monitoring: {
        nextAssessment: overallRisk === 'imminent' ? 'Continuous' : 
                       overallRisk === 'high' ? 'Within 24 hours' : 
                       'Within 1 week',
        watchlist: [
          'Suicidal ideation escalation',
          'Self-harm behaviors',
          'Social isolation',
          'Substance use increases'
        ],
        checkInSchedule: overallRisk === 'high' ? ['Daily for 1 week', 'Every 2 days for 2 weeks'] : 
                        ['Every 3 days for 1 week', 'Weekly for 1 month']
      },
      metadata: {
        algorithmVersion: '2.1.0',
        confidenceScore: Math.min(95, Math.max(60, 85 - (indicators.length > 5 ? 10 : 0) + (timeline !== 'no_timeline' ? 10 : 0))),
        processingTime,
        flags,
        reviewRequired: overallRisk === 'high' || overallRisk === 'imminent'
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Risk-Level': overallRisk,
        'X-Crisis-Detected': (overallRisk === 'high' || overallRisk === 'imminent').toString(),
        'X-Processing-Time': processingTime.toString()
      }
    })

  } catch (error) {
    console.error('Crisis detection error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error during crisis detection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
