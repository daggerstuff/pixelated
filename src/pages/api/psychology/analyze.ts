export const prerender = false

export interface AnalyzeRequest {
  content: string
  analysisType: 'session' | 'progress' | 'intervention' | 'risk' | 'comprehensive'
  clientContext?: {
    id?: string
    demographics?: {
      age?: number
      gender?: string
      background?: string
    }
    history?: {
      previousSessions?: number
      therapeuticGoals?: string[]
      currentConcerns?: string[]
      riskFactors?: string[]
    }
    preferences?: {
      communicationStyle?: string
      culturalConsiderations?: string[]
      previousTreatments?: string[]
    }
  }
  analysisOptions?: {
    includeRecommendations?: boolean
    includeRiskAssessment?: boolean
    includeProgressMetrics?: boolean
    includeCulturalFactors?: boolean
    framework?: string
  }
}

export interface AnalyzeResponse {
  analysis: {
    type: string
    summary: string
    keyFindings: string[]
    clinicalObservations: ClinicalObservation[]
    riskAssessment?: RiskAssessment
    progressMetrics?: ProgressMetrics
    culturalFactors?: CulturalFactor[]
  }
  recommendations: {
    immediate: Recommendation[]
    shortTerm: Recommendation[]
    longTerm: Recommendation[]
    supervision?: string[]
  }
  interventionSuggestions: InterventionSuggestion[]
  followUpActions: FollowUpAction[]
  metadata: {
    analysisType: string
    framework?: string
    confidenceScore: number
    processingTime: number
    generatedAt: string
    flags: string[]
  }
}

export interface ClinicalObservation {
  category: 'affect' | 'cognition' | 'behavior' | 'interpersonal' | 'risk' | 'strength'
  observation: string
  severity: 'low' | 'moderate' | 'high'
  clinicalSignificance: string
  supportingEvidence: string[]
}

export interface RiskAssessment {
  overallRisk: 'low' | 'moderate' | 'high' | 'imminent'
  suicidalIdeation: {
    present: boolean
    severity: 'none' | 'passive' | 'active' | 'with_plan' | 'with_intent'
    indicators: string[]
  }
  selfHarm: {
    risk: 'low' | 'moderate' | 'high'
    indicators: string[]
  }
  substanceUse: {
    risk: 'low' | 'moderate' | 'high'
    indicators: string[]
  }
  psychosis: {
    risk: 'low' | 'moderate' | 'high'
    indicators: string[]
  }
  immediateActions: string[]
}

export interface ProgressMetrics {
  symptomSeverity: {
    current: number // 1-10
    baseline?: number
    trend: 'improving' | 'stable' | 'worsening'
    indicators: string[]
  }
  functionalImpairment: {
    current: number // 1-10
    baseline?: number
    trend: 'improving' | 'stable' | 'worsening'
    domains: Record<string, number>
  }
  therapeuticAlliance: {
    strength: 'weak' | 'moderate' | 'strong'
    indicators: string[]
  }
  goalProgress: {
    goal: string
    completion: number // 0-100%
    milestones: string[]
  }[]
}

export interface CulturalFactor {
  domain: 'communication' | 'family' | 'spirituality' | 'identity' | 'social'
  factor: string
  impact: 'positive' | 'neutral' | 'challenging'
  considerations: string[]
}

export interface Recommendation {
  category: 'intervention' | 'assessment' | 'referral' | 'safety' | 'self-care'
  priority: 'high' | 'medium' | 'low'
  recommendation: string
  rationale: string
  timeframe: string
  resources?: string[]
}

export interface InterventionSuggestion {
  technique: string
  framework: string
  description: string
  implementation: string
  duration: string
  materials: string[]
  skillLevel: 'beginner' | 'intermediate' | 'advanced'
  expectedOutcome: string
  contraindications: string[]
}

export interface FollowUpAction {
  action: string
  timeframe: string
  responsibility: 'therapist' | 'client' | 'both' | 'external'
  priority: 'high' | 'medium' | 'low'
  measurableOutcome: string
}

// Clinical analysis patterns
const CLINICAL_PATTERNS = {
  affect: [
    { pattern: /depressed|sad|down|hopeless|worthless/gi, category: 'depressive', severity: 'moderate' },
    { pattern: /anxious|worried|nervous|panic|afraid/gi, category: 'anxiety', severity: 'moderate' },
    { pattern: /angry|mad|furious|rage|irritated/gi, category: 'anger', severity: 'moderate' },
    { pattern: /numb|empty|disconnected|void/gi, category: 'dissociation', severity: 'high' },
    { pattern: /happy|good|better|positive|hopeful/gi, category: 'positive', severity: 'low' }
  ],
  cognition: [
    { pattern: /can't think|confused|foggy|scattered/gi, category: 'concentration', severity: 'moderate' },
    { pattern: /racing thoughts|can't stop thinking|overwhelmed/gi, category: 'rumination', severity: 'moderate' },
    { pattern: /worthless|failure|stupid|useless/gi, category: 'negative_self', severity: 'high' },
    { pattern: /catastrophe|worst case|disaster|terrible/gi, category: 'catastrophizing', severity: 'moderate' }
  ],
  behavior: [
    { pattern: /sleep|insomnia|tired|exhausted/gi, category: 'sleep', severity: 'moderate' },
    { pattern: /eating|appetite|weight|food/gi, category: 'appetite', severity: 'moderate' },
    { pattern: /isolating|alone|avoiding|withdrawn/gi, category: 'withdrawal', severity: 'moderate' },
    { pattern: /active|exercising|engaged|motivated/gi, category: 'activation', severity: 'low' }
  ],
  risk: [
    { pattern: /suicide|kill myself|end it all|not worth living/gi, category: 'suicidal', severity: 'high' },
    { pattern: /cutting|self-harm|hurt myself|punish myself/gi, category: 'self_harm', severity: 'high' },
    { pattern: /drinking|drugs|using|high|drunk/gi, category: 'substance', severity: 'moderate' },
    { pattern: /hearing voices|seeing things|paranoid|conspiracy/gi, category: 'psychosis', severity: 'high' }
  ]
}

const STRENGTH_INDICATORS = [
  'support system', 'family', 'friends', 'job', 'stable', 'coping', 'resilient',
  'motivated', 'insight', 'awareness', 'strength', 'resource', 'skill'
]

function analyzeContent(content: string): ClinicalObservation[] {
  const observations: ClinicalObservation[] = []
  const lowerContent = content.toLowerCase()

  // Analyze each pattern category
  Object.entries(CLINICAL_PATTERNS).forEach(([category, patterns]) => {
    patterns.forEach(({ pattern, category: subCategory, severity }) => {
      const matches = content.match(pattern)
      if (matches && matches.length > 0) {
        observations.push({
          category: category as ClinicalObservation['category'],
          observation: `Client exhibits ${subCategory} indicators`,
          severity: severity as ClinicalObservation['severity'],
          clinicalSignificance: `Presents with ${subCategory} symptoms requiring clinical attention`,
          supportingEvidence: matches.slice(0, 3) // Limit to first 3 matches
        })
      }
    })
  })

  // Identify strengths
  STRENGTH_INDICATORS.forEach(strength => {
    if (lowerContent.includes(strength)) {
      observations.push({
        category: 'strength',
        observation: `Client demonstrates ${strength} as protective factor`,
        severity: 'low',
        clinicalSignificance: 'Positive resource for treatment planning',
        supportingEvidence: [`Mentioned "${strength}" in context`]
      })
    }
  })

  return observations
}

function assessRisk(content: string, observations: ClinicalObservation[]): RiskAssessment {
  // Suicidal ideation assessment
  const suicidalPatterns = {
    passive: /wish I was dead|better off dead|tired of living/gi,
    active: /want to die|suicide|kill myself|end my life/gi,
    plan: /plan to|how to|method|when I|specific way/gi,
    intent: /going to|will do|tonight|tomorrow|soon/gi
  }

  let suicidalSeverity: RiskAssessment['suicidalIdeation']['severity'] = 'none'
  const suicidalIndicators: string[] = []

  Object.entries(suicidalPatterns).forEach(([level, pattern]) => {
    const matches = content.match(pattern)
    if (matches) {
      suicidalIndicators.push(...matches.slice(0, 2))
      if (level === 'intent') {
        suicidalSeverity = 'with_intent'
      } else if (level === 'plan' && suicidalSeverity !== 'with_intent') {
        suicidalSeverity = 'with_plan'
      } else if (level === 'active' && !['with_intent', 'with_plan'].includes(suicidalSeverity)) {
        suicidalSeverity = 'active'
      } else if (level === 'passive' && suicidalSeverity === 'none') {
        suicidalSeverity = 'passive'
      }
    }
  })

  // Overall risk calculation
  const riskObservations = observations.filter(obs => obs.category === 'risk')
  const highSeverityObs = observations.filter(obs => obs.severity === 'high')
  
  let overallRisk: RiskAssessment['overallRisk'] = 'low'
  if ((suicidalSeverity as string) === 'with_intent' || highSeverityObs.length > 2) {
    overallRisk = 'imminent'
  } else if ((suicidalSeverity as string) === 'with_plan' || riskObservations.length > 1) {
    overallRisk = 'high'
  } else if (suicidalSeverity !== 'none' || riskObservations.length > 0) {
    overallRisk = 'moderate'
  }

  return {
    overallRisk,
    suicidalIdeation: {
      present: suicidalSeverity !== 'none',
      severity: suicidalSeverity,
      indicators: suicidalIndicators
    },
    selfHarm: {
      risk: observations.some(obs => obs.observation.includes('self-harm')) ? 'high' : 'low',
      indicators: observations.filter(obs => obs.observation.includes('self-harm')).map(obs => obs.observation)
    },
    substanceUse: {
      risk: observations.some(obs => obs.observation.includes('substance')) ? 'moderate' : 'low',
      indicators: observations.filter(obs => obs.observation.includes('substance')).map(obs => obs.observation)
    },
    psychosis: {
      risk: observations.some(obs => obs.observation.includes('psychosis')) ? 'high' : 'low',
      indicators: observations.filter(obs => obs.observation.includes('psychosis')).map(obs => obs.observation)
    },
    immediateActions: overallRisk === 'imminent' ? [
      'Conduct immediate safety assessment',
      'Contact emergency services if necessary',
      'Implement safety plan',
      'Notify supervisor'
    ] : overallRisk === 'high' ? [
      'Develop comprehensive safety plan',
      'Increase session frequency',
      'Consider hospitalization assessment'
    ] : []
  }
}

function generateRecommendations(
  observations: ClinicalObservation[],
  riskAssessment: RiskAssessment
): {
  immediate: Recommendation[]
  shortTerm: Recommendation[]
  longTerm: Recommendation[]
  supervision?: string[]
} {
  const immediate: Recommendation[] = []
  const shortTerm: Recommendation[] = []
  const longTerm: Recommendation[] = []
  const supervision: string[] = []

  // Risk-based recommendations
  if (riskAssessment.overallRisk === 'imminent' || riskAssessment.overallRisk === 'high') {
    immediate.push({
      category: 'safety',
      priority: 'high',
      recommendation: 'Implement immediate safety planning and risk management',
      rationale: 'High risk assessment requires immediate intervention',
      timeframe: 'Immediately',
      resources: ['Crisis hotline numbers', 'Emergency contacts', 'Safety plan template']
    })
    supervision.push('Discuss case immediately with supervisor')
  }

  // Depression indicators
  if (observations.some(obs => obs.observation.includes('depressive'))) {
    shortTerm.push({
      category: 'intervention',
      priority: 'high',
      recommendation: 'Implement depression-focused CBT interventions',
      rationale: 'Client presenting with depressive symptoms',
      timeframe: '2-3 sessions',
      resources: ['CBT worksheets', 'Behavioral activation schedule']
    })
  }

  // Anxiety indicators
  if (observations.some(obs => obs.observation.includes('anxiety'))) {
    shortTerm.push({
      category: 'intervention',
      priority: 'medium',
      recommendation: 'Introduce anxiety management techniques',
      rationale: 'Client experiencing anxiety symptoms',
      timeframe: '1-2 sessions',
      resources: ['Relaxation recordings', 'Breathing exercise instructions']
    })
  }

  // Strengths-based recommendations
  const strengths = observations.filter(obs => obs.category === 'strength')
  if (strengths.length > 0) {
    longTerm.push({
      category: 'intervention',
      priority: 'medium',
      recommendation: 'Build on identified client strengths and resources',
      rationale: 'Client has protective factors that can support recovery',
      timeframe: 'Ongoing',
      resources: ['Strengths inventory', 'Resource mapping exercises']
    })
  }

  return { immediate, shortTerm, longTerm, supervision }
}

function calculateProgressMetrics(content: string, clientContext?: AnalyzeRequest['clientContext']): ProgressMetrics {
  const positiveIndicators = content.match(/better|good|improved|progress|hopeful/gi)?.length || 0
  const negativeIndicators = content.match(/worse|bad|difficult|struggling|hard/gi)?.length || 0
  
  const symptomSeverity = Math.max(1, Math.min(10, 5 + negativeIndicators - positiveIndicators))
  
  return {
    symptomSeverity: {
      current: symptomSeverity,
      baseline: clientContext?.history?.previousSessions ? symptomSeverity + 1 : undefined,
      trend: positiveIndicators > negativeIndicators ? 'improving' : positiveIndicators < negativeIndicators ? 'worsening' : 'stable',
      indicators: positiveIndicators > negativeIndicators ? ['Positive language use', 'Hope expression'] : ['Distress indicators', 'Negative language']
    },
    functionalImpairment: {
      current: symptomSeverity,
      baseline: clientContext?.history?.previousSessions ? symptomSeverity + 1 : undefined,
      trend: positiveIndicators > negativeIndicators ? 'improving' : 'stable',
      domains: {
        work: Math.max(1, symptomSeverity - 1),
        relationships: symptomSeverity,
        self_care: Math.min(10, symptomSeverity + 1)
      }
    },
    therapeuticAlliance: {
      strength: content.includes('comfortable') || content.includes('helpful') ? 'strong' : 'moderate',
      indicators: ['Engaged in session', 'Open communication']
    },
    goalProgress: clientContext?.history?.therapeuticGoals?.map(goal => ({
      goal,
      completion: Math.floor(Math.random() * 60) + 20, // Simulated progress
      milestones: ['Initial discussion', 'Goal setting', 'Strategy development']
    })) || []
  }
}

export const POST = async ({ request }: APIContext) => {
  const startTime = Date.now()
  
  try {
    const body: AnalyzeRequest = await request.json()
    
    if (!body.content || typeof body.content !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Invalid request: content is required and must be a string' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!['session', 'progress', 'intervention', 'risk', 'comprehensive'].includes(body.analysisType)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid analysis type: must be session, progress, intervention, risk, or comprehensive' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const options = {
      includeRecommendations: true,
      includeRiskAssessment: true,
      includeProgressMetrics: true,
      includeCulturalFactors: true,
      ...body.analysisOptions
    }

    // Perform clinical analysis
    const observations = analyzeContent(body.content)
    const riskAssessment = options.includeRiskAssessment ? assessRisk(body.content, observations) : undefined
    const progressMetrics = options.includeProgressMetrics ? calculateProgressMetrics(body.content, body.clientContext) : undefined
    
    // Generate recommendations
    const recommendations = options.includeRecommendations ? 
      generateRecommendations(observations, riskAssessment!) : 
      { immediate: [], shortTerm: [], longTerm: [] }

    // Calculate confidence score
    const confidenceScore = Math.min(100, Math.max(60, 85 - (observations.length > 10 ? 10 : 0) + (body.content.length > 500 ? 10 : 0)))

    const processingTime = Date.now() - startTime

    const response: AnalyzeResponse = {
      analysis: {
        type: body.analysisType,
        summary: `Clinical analysis identified ${observations.length} key observations with ${riskAssessment?.overallRisk || 'unknown'} risk level`,
        keyFindings: observations.slice(0, 5).map(obs => obs.observation),
        clinicalObservations: observations,
        riskAssessment,
        progressMetrics,
        culturalFactors: options.includeCulturalFactors ? [
          {
            domain: 'communication',
            factor: 'Client communication style appears direct and open',
            impact: 'positive',
            considerations: ['Continue current approach', 'Monitor for cultural preferences']
          }
        ] : undefined
      },
      recommendations,
      interventionSuggestions: [
        {
          technique: 'Cognitive Restructuring',
          framework: 'CBT',
          description: 'Challenge and modify unhelpful thought patterns',
          implementation: 'Identify automatic thoughts and examine evidence',
          duration: '15-20 minutes',
          materials: ['Thought record worksheet'],
          skillLevel: 'intermediate',
          expectedOutcome: 'Reduced cognitive distortions',
          contraindications: ['Active psychosis', 'Severe cognitive impairment']
        }
      ],
      followUpActions: [
        {
          action: 'Schedule follow-up session',
          timeframe: '1 week',
          responsibility: 'therapist',
          priority: 'high',
          measurableOutcome: 'Client attends next scheduled session'
        }
      ],
      metadata: {
        analysisType: body.analysisType,
        framework: body.analysisOptions?.framework,
        confidenceScore,
        processingTime,
        generatedAt: new Date().toISOString(),
        flags: riskAssessment?.overallRisk === 'high' || riskAssessment?.overallRisk === 'imminent' ? ['HIGH_RISK'] : []
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Analysis-Type': body.analysisType,
        'X-Confidence-Score': confidenceScore.toString(),
        'X-Processing-Time': processingTime.toString()
      }
    })

  } catch (error: unknown) {
    console.error('Psychology analysis error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error during content analysis',
      details: error instanceof Error ? String(error) : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
