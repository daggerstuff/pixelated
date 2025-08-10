export const prerender = false

export interface GenerateScenarioRequest {
  context: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  framework?: string
  clientProfile?: {
    age?: number
    gender?: string
    background?: string
    presenting_concern?: string
  }
  options?: {
    includeAssessment?: boolean
    includeLearningObjectives?: boolean
    includeInterventions?: boolean
  }
}

export interface GenerateScenarioResponse {
  scenario: {
    id: string
    title: string
    description: string
    clientProfile: {
      name: string
      age: number
      gender: string
      background: string
      presentingConcern: string
      history: string
      currentSituation: string
    }
    sessionContext: {
      sessionNumber: number
      previousSessions: string[]
      currentGoals: string[]
      therapeuticAlliance: 'building' | 'established' | 'strong'
    }
    challengeLevel: string
    estimatedDuration: string
  }
  learningObjectives: string[]
  assessmentCriteria: {
    category: string
    criteria: string[]
    weight: number
  }[]
  suggestedInterventions: {
    technique: string
    rationale: string
    implementation: string
    expectedOutcome: string
  }[]
  supervision_notes: string[]
  metadata: {
    difficulty: string
    framework: string
    generatedAt: string
    version: string
  }
}

// Realistic client profiles by difficulty
const CLIENT_PROFILES = {
  beginner: [
    {
      name: 'Sarah Johnson',
      age: 28,
      gender: 'Female',
      background: 'Marketing professional, college educated, stable housing',
      presentingConcern: 'Work-related stress and mild anxiety',
      history: 'No previous therapy experience, supportive family, generally good coping skills',
      challenges: ['Time management', 'Setting boundaries at work', 'Perfectionism']
    },
    {
      name: 'Mike Chen',
      age: 35,
      gender: 'Male',
      background: 'Software engineer, married with one child',
      presentingConcern: 'Adjustment difficulties after job change',
      history: 'One previous brief counseling episode, good social support',
      challenges: ['Career transition stress', 'Work-life balance', 'Imposter syndrome']
    }
  ],
  intermediate: [
    {
      name: 'Dr. Patricia Williams',
      age: 45,
      gender: 'Female',
      background: 'Physician, divorced, two teenage children',
      presentingConcern: 'Burnout and depression following divorce',
      history: 'High-functioning depression, previous therapy with mixed results',
      challenges: ['Professional identity crisis', 'Co-parenting conflicts', 'Perfectionism', 'Emotional numbness']
    },
    {
      name: 'James Rodriguez',
      age: 22,
      gender: 'Male',
      background: 'College student, first-generation immigrant family',
      presentingConcern: 'Social anxiety and academic pressure',
      history: 'Cultural stigma around mental health, family expectations',
      challenges: ['Cultural identity conflicts', 'Performance anxiety', 'Family loyalty vs. independence']
    }
  ],
  advanced: [
    {
      name: 'Alex Turner',
      age: 30,
      gender: 'Non-binary',
      background: 'Artist, history of trauma, unstable housing',
      presentingConcern: 'Complex PTSD and relationship difficulties',
      history: 'Multiple previous therapists, some negative experiences, trust issues',
      challenges: ['Attachment difficulties', 'Emotional dysregulation', 'Identity exploration', 'Trauma processing']
    },
    {
      name: 'Robert Kim',
      age: 52,
      gender: 'Male',
      background: 'Veteran, small business owner, married',
      presentingConcern: 'PTSD, substance use, and anger management',
      history: 'Military trauma, previous unsuccessful treatment attempts, family strain',
      challenges: ['Combat trauma', 'Alcohol dependence', 'Marital conflict', 'Emotional avoidance']
    }
  ]
}

const THERAPEUTIC_FRAMEWORKS_DETAILED = {
  'CBT': {
    name: 'Cognitive Behavioral Therapy',
    interventions: [
      { technique: 'Thought Record', rationale: 'Identify cognitive distortions', implementation: 'Have client track thoughts, feelings, and situations', expectedOutcome: 'Increased awareness of thought patterns' },
      { technique: 'Behavioral Activation', rationale: 'Increase pleasant activities', implementation: 'Schedule meaningful activities', expectedOutcome: 'Improved mood and engagement' },
      { technique: 'Cognitive Restructuring', rationale: 'Challenge negative thoughts', implementation: 'Examine evidence for/against thoughts', expectedOutcome: 'More balanced thinking' }
    ],
    assessmentAreas: ['Thought identification', 'Homework completion', 'Skill application', 'Therapeutic rapport']
  },
  'DBT': {
    name: 'Dialectical Behavior Therapy',
    interventions: [
      { technique: 'Distress Tolerance Skills', rationale: 'Manage crisis situations', implementation: 'Teach TIPP skills (Temperature, Intense exercise, Paced breathing, Paired muscle relaxation)', expectedOutcome: 'Reduced impulsive behaviors' },
      { technique: 'Emotion Regulation', rationale: 'Understand and manage emotions', implementation: 'Emotion identification and PLEASE skills', expectedOutcome: 'Better emotional control' },
      { technique: 'Mindfulness', rationale: 'Present-moment awareness', implementation: 'Observe, describe, participate exercises', expectedOutcome: 'Increased self-awareness' }
    ],
    assessmentAreas: ['Skills practice', 'Crisis management', 'Emotion regulation', 'Interpersonal effectiveness']
  },
  'ACT': {
    name: 'Acceptance and Commitment Therapy',
    interventions: [
      { technique: 'Values Clarification', rationale: 'Identify core values', implementation: 'Values card sort and discussion', expectedOutcome: 'Clear value direction' },
      { technique: 'Cognitive Defusion', rationale: 'Reduce impact of difficult thoughts', implementation: 'Thought observation exercises', expectedOutcome: 'Psychological flexibility' },
      { technique: 'Mindful Acceptance', rationale: 'Accept difficult emotions', implementation: 'Present-moment awareness exercises', expectedOutcome: 'Reduced avoidance' }
    ],
    assessmentAreas: ['Value identification', 'Psychological flexibility', 'Mindfulness practice', 'Behavioral commitment']
  }
}

function generateUniqueId(): string {
  return `scenario_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function selectClientProfile(difficulty: string, clientProfile?: Partial<GenerateScenarioRequest['clientProfile']>): any {
  const profiles = CLIENT_PROFILES[difficulty as keyof typeof CLIENT_PROFILES] || CLIENT_PROFILES.beginner
  const baseProfile = profiles[Math.floor(Math.random() * profiles.length)]
  
  return {
    ...baseProfile,
    ...clientProfile
  }
}

function generateSessionContext(difficulty: string): any {
  const sessionNumbers = {
    beginner: Math.floor(Math.random() * 3) + 1, // 1-3
    intermediate: Math.floor(Math.random() * 5) + 3, // 3-7
    advanced: Math.floor(Math.random() * 8) + 5 // 5-12
  }

  const sessionNumber = sessionNumbers[difficulty as keyof typeof sessionNumbers] || 1

  const previousSessions = sessionNumber > 1 ? [
    'Initial assessment and rapport building',
    'Identified presenting concerns and goals',
    ...(sessionNumber > 2 ? ['Explored background and history'] : []),
    ...(sessionNumber > 3 ? ['Introduced therapeutic interventions'] : []),
    ...(sessionNumber > 5 ? ['Addressed resistance and challenges'] : [])
  ].slice(0, sessionNumber - 1) : []

  return {
    sessionNumber,
    previousSessions,
    currentGoals: generateGoals(difficulty),
    therapeuticAlliance: sessionNumber <= 2 ? 'building' : sessionNumber <= 5 ? 'established' : 'strong'
  }
}

function generateGoals(difficulty: string): string[] {
  const goalSets = {
    beginner: [
      'Reduce work-related stress',
      'Improve time management skills',
      'Develop healthy coping strategies'
    ],
    intermediate: [
      'Process grief and loss',
      'Improve interpersonal relationships',
      'Develop emotional regulation skills',
      'Address cognitive distortions'
    ],
    advanced: [
      'Process traumatic experiences safely',
      'Develop healthy attachment patterns',
      'Integrate fragmented aspects of identity',
      'Build distress tolerance skills',
      'Address substance use patterns'
    ]
  }

  const goals = goalSets[difficulty as keyof typeof goalSets] || goalSets.beginner
  return goals.slice(0, Math.floor(Math.random() * 2) + 2) // 2-3 goals
}

function generateInterventions(framework: string, difficulty: string): any[] {
  const frameworkData = THERAPEUTIC_FRAMEWORKS_DETAILED[framework as keyof typeof THERAPEUTIC_FRAMEWORKS_DETAILED] || THERAPEUTIC_FRAMEWORKS_DETAILED.CBT
  
  const numInterventions = difficulty === 'beginner' ? 2 : difficulty === 'intermediate' ? 3 : 4
  
  return frameworkData.interventions.slice(0, numInterventions)
}

function generateAssessmentCriteria(framework: string): any[] {
  const frameworkData = THERAPEUTIC_FRAMEWORKS_DETAILED[framework as keyof typeof THERAPEUTIC_FRAMEWORKS_DETAILED] || THERAPEUTIC_FRAMEWORKS_DETAILED.CBT
  
  return [
    {
      category: 'Therapeutic Relationship',
      criteria: ['Demonstrates empathy and warmth', 'Maintains appropriate boundaries', 'Shows cultural sensitivity'],
      weight: 25
    },
    {
      category: 'Clinical Skills',
      criteria: frameworkData.assessmentAreas.map(area => `Demonstrates competency in ${area}`),
      weight: 40
    },
    {
      category: 'Ethical Practice',
      criteria: ['Maintains confidentiality', 'Recognizes scope of practice', 'Documents appropriately'],
      weight: 20
    },
    {
      category: 'Professional Development',
      criteria: ['Seeks supervision when needed', 'Reflects on practice', 'Continues learning'],
      weight: 15
    }
  ]
}

function generateSupervisionNotes(difficulty: string, framework: string): string[] {
  const notes = [
    `Focus on ${framework} technique implementation`,
    'Monitor for countertransference reactions',
    'Assess safety and risk factors regularly'
  ]

  if (difficulty === 'intermediate') {
    notes.push('Watch for cultural considerations', 'Consider family dynamics')
  }

  if (difficulty === 'advanced') {
    notes.push('Trauma-informed care essential', 'Consider consultation needs', 'Monitor therapist self-care')
  }

  return notes
}

export const POST = async ({ request }: { request: Request }) => {
  try {
    const body: GenerateScenarioRequest = await request.json()
    
    if (!body.context || typeof body.context !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Invalid request: context is required and must be a string' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(body.difficulty)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid difficulty level: must be beginner, intermediate, or advanced' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const framework = body.framework || 'CBT'
    const options = {
      includeAssessment: true,
      includeLearningObjectives: true,
      includeInterventions: true,
      ...body.options
    }

    const clientProfile = selectClientProfile(body.difficulty, body.clientProfile)
    const sessionContext = generateSessionContext(body.difficulty)
    
    const scenario = {
      id: generateUniqueId(),
      title: `${body.difficulty.charAt(0).toUpperCase() + body.difficulty.slice(1)} Case: ${clientProfile.name}`,
      description: `${framework}-based therapy session focusing on ${body.context}`,
      clientProfile: {
        name: clientProfile.name,
        age: clientProfile.age,
        gender: clientProfile.gender,
        background: clientProfile.background,
        presentingConcern: clientProfile.presentingConcern,
        history: clientProfile.history,
        currentSituation: `Client presents for session ${sessionContext.sessionNumber} with ongoing concerns about ${body.context}. ${clientProfile.challenges ? 'Current challenges include: ' + clientProfile.challenges.join(', ') + '.' : ''}`
      },
      sessionContext,
      challengeLevel: `${body.difficulty} level case requiring ${framework} intervention skills`,
      estimatedDuration: body.difficulty === 'beginner' ? '45-50 minutes' : body.difficulty === 'intermediate' ? '50-60 minutes' : '60-75 minutes'
    }

    const learningObjectives = options.includeLearningObjectives ? [
      `Apply ${framework} techniques appropriately`,
      `Demonstrate therapeutic rapport and alliance building`,
      `Assess and manage risk factors`,
      `Implement culturally sensitive interventions`,
      `Document session notes according to professional standards`
    ] : []

    const assessmentCriteria = options.includeAssessment ? generateAssessmentCriteria(framework) : []
    const suggestedInterventions = options.includeInterventions ? generateInterventions(framework, body.difficulty) : []
    const supervision_notes = generateSupervisionNotes(body.difficulty, framework)

    const response: GenerateScenarioResponse = {
      scenario,
      learningObjectives,
      assessmentCriteria,
      suggestedInterventions,
      supervision_notes,
      metadata: {
        difficulty: body.difficulty,
        framework,
        generatedAt: new Date().toISOString(),
        version: '1.0'
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Scenario-ID': scenario.id
      }
    })

  } catch (error) {
    console.error('Psychology scenario generation error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error during scenario generation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
