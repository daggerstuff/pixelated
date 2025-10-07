export const prerender = false

export interface FrameworksRequest {
  query?: string
  category?: 'all' | 'cognitive' | 'behavioral' | 'humanistic' | 'psychodynamic' | 'systemic'
  evidenceLevel?: 'strong' | 'moderate' | 'emerging' | 'all'
  clientPopulation?: string
  issue?: string
}

export interface FrameworksResponse {
  frameworks: TherapeuticFramework[]
  totalCount: number
  filteredCount: number
  categories: string[]
  metadata: {
    searchQuery?: string
    appliedFilters: Record<string, string>
    generatedAt: string
  }
}

export interface TherapeuticFramework {
  id: string
  name: string
  acronym: string
  category: string
  description: string
  foundationalPrinciples: string[]
  keyTechniques: Technique[]
  evidenceBase: {
    level: 'strong' | 'moderate' | 'emerging'
    supportedConditions: string[]
    researchSummary: string
    effectivenessRating: number // 1-10
  }
  clientPopulations: string[]
  sessionStructure: {
    typicalLength: string
    frequency: string
    duration: string
    phases: string[]
  }
  requiredTraining: {
    level: 'basic' | 'intermediate' | 'advanced' | 'specialized'
    certificationRequired: boolean
    prerequisites: string[]
    recommendedHours: number
  }
  contraindications: string[]
  culturalConsiderations: string[]
  integration: {
    combinesWith: string[]
    commonAdaptations: string[]
  }
}

export interface Technique {
  name: string
  description: string
  implementation: string
  duration: string
  skillLevel: 'beginner' | 'intermediate' | 'advanced'
  materials?: string[]
}

// Comprehensive therapeutic frameworks database
const THERAPEUTIC_FRAMEWORKS: TherapeuticFramework[] = [
  {
    id: 'cbt',
    name: 'Cognitive Behavioral Therapy',
    acronym: 'CBT',
    category: 'cognitive',
    description: 'Evidence-based approach focusing on the relationship between thoughts, feelings, and behaviors',
    foundationalPrinciples: [
      'Thoughts influence emotions and behaviors',
      'Present-focused problem solving',
      'Collaborative therapeutic relationship',
      'Structured and goal-oriented sessions',
      'Homework and between-session practice'
    ],
    keyTechniques: [
      {
        name: 'Thought Record',
        description: 'Systematic identification and examination of automatic thoughts',
        implementation: 'Client records situations, emotions, thoughts, and evidence',
        duration: '10-15 minutes',
        skillLevel: 'beginner',
        materials: ['Thought record worksheet', 'Pen/pencil']
      },
      {
        name: 'Behavioral Activation',
        description: 'Increasing engagement in meaningful activities',
        implementation: 'Schedule pleasant and mastery activities',
        duration: '15-20 minutes',
        skillLevel: 'beginner'
      },
      {
        name: 'Cognitive Restructuring',
        description: 'Challenging and modifying unhelpful thought patterns',
        implementation: 'Examine evidence for/against thoughts, develop balanced alternatives',
        duration: '20-30 minutes',
        skillLevel: 'intermediate'
      },
      {
        name: 'Exposure Therapy',
        description: 'Gradual confrontation of feared situations or stimuli',
        implementation: 'Create hierarchy, systematic desensitization',
        duration: '30-45 minutes',
        skillLevel: 'advanced'
      }
    ],
    evidenceBase: {
      level: 'strong',
      supportedConditions: ['Depression', 'Anxiety disorders', 'PTSD', 'OCD', 'Eating disorders', 'Substance use'],
      researchSummary: 'Over 500 RCTs demonstrate efficacy across multiple conditions. Gold standard treatment for many mental health conditions.',
      effectivenessRating: 9
    },
    clientPopulations: ['Adults', 'Adolescents', 'Children (adapted)', 'Older adults', 'Groups'],
    sessionStructure: {
      typicalLength: '45-50 minutes',
      frequency: 'Weekly',
      duration: '12-20 sessions',
      phases: ['Assessment and psychoeducation', 'Skill building', 'Practice and application', 'Relapse prevention']
    },
    requiredTraining: {
      level: 'intermediate',
      certificationRequired: false,
      prerequisites: ['Basic counseling skills', 'Understanding of psychopathology'],
      recommendedHours: 40
    },
    contraindications: ['Active psychosis', 'Severe cognitive impairment', 'Crisis situations requiring immediate intervention'],
    culturalConsiderations: ['Collectivist vs individualist values', 'Religious/spiritual beliefs', 'Language barriers', 'Stigma around mental health'],
    integration: {
      combinesWith: ['Mindfulness-based interventions', 'Acceptance approaches', 'Psychodynamic therapy'],
      commonAdaptations: ['Culturally adapted CBT', 'Trauma-focused CBT', 'Internet-delivered CBT']
    }
  },
  {
    id: 'dbt',
    name: 'Dialectical Behavior Therapy',
    acronym: 'DBT',
    category: 'behavioral',
    description: 'Comprehensive treatment combining CBT with mindfulness and distress tolerance skills',
    foundationalPrinciples: [
      'Dialectical thinking (both/and vs either/or)',
      'Validation and change strategies',
      'Mindfulness as core skill',
      'Distress tolerance without making worse',
      'Biosocial theory of emotion dysregulation'
    ],
    keyTechniques: [
      {
        name: 'Mindfulness Skills',
        description: 'Present-moment awareness and observation',
        implementation: 'Observe, describe, participate; non-judgmentally, one-mindfully, effectively',
        duration: '10-15 minutes',
        skillLevel: 'beginner'
      },
      {
        name: 'Distress Tolerance',
        description: 'Crisis survival skills',
        implementation: 'TIPP (Temperature, Intense exercise, Paced breathing, Paired muscle relaxation)',
        duration: '5-10 minutes',
        skillLevel: 'intermediate'
      },
      {
        name: 'Emotion Regulation',
        description: 'Understanding and managing emotional experiences',
        implementation: 'PLEASE skills, opposite action, emotion surfing',
        duration: '15-20 minutes',
        skillLevel: 'intermediate'
      },
      {
        name: 'Interpersonal Effectiveness',
        description: 'Maintaining relationships while meeting needs',
        implementation: 'DEAR MAN, GIVE, FAST skills',
        duration: '20-25 minutes',
        skillLevel: 'advanced'
      }
    ],
    evidenceBase: {
      level: 'strong',
      supportedConditions: ['Borderline Personality Disorder', 'Self-harm behaviors', 'Suicidal ideation', 'Eating disorders', 'Substance use'],
      researchSummary: 'Extensive research demonstrating effectiveness for BPD and emotion dysregulation. Reduces self-harm and hospitalization.',
      effectivenessRating: 8
    },
    clientPopulations: ['Adults with BPD', 'Adolescents', 'Individuals with emotion dysregulation', 'Self-harm behaviors'],
    sessionStructure: {
      typicalLength: '50-90 minutes',
      frequency: 'Weekly individual + group skills training',
      duration: '12-24 months',
      phases: ['Pre-treatment', 'Stage 1: Behavioral control', 'Stage 2: Emotional experiencing', 'Stage 3: Life goals']
    },
    requiredTraining: {
      level: 'specialized',
      certificationRequired: true,
      prerequisites: ['Advanced clinical training', 'DBT intensive training', 'Ongoing consultation'],
      recommendedHours: 120
    },
    contraindications: ['Unwillingness to commit to treatment', 'Active substance dependence without treatment', 'Severe cognitive impairment'],
    culturalConsiderations: ['Eastern philosophy integration', 'Collectivist family values', 'Spiritual practices', 'Gender role expectations'],
    integration: {
      combinesWith: ['Trauma-focused therapy', 'Family therapy', 'Medication management'],
      commonAdaptations: ['DBT-A for adolescents', 'RO-DBT for over-control', 'DBT-PE for PTSD']
    }
  },
  {
    id: 'act',
    name: 'Acceptance and Commitment Therapy',
    acronym: 'ACT',
    category: 'behavioral',
    description: 'Third-wave therapy focusing on psychological flexibility and values-based living',
    foundationalPrinciples: [
      'Psychological flexibility as core process',
      'Acceptance of difficult internal experiences',
      'Commitment to values-based action',
      'Mindfulness and present-moment awareness',
      'Cognitive defusion from unhelpful thoughts'
    ],
    keyTechniques: [
      {
        name: 'Values Clarification',
        description: 'Identifying core life values and directions',
        implementation: 'Values card sort, values exploration exercises',
        duration: '20-30 minutes',
        skillLevel: 'beginner'
      },
      {
        name: 'Cognitive Defusion',
        description: 'Changing relationship with thoughts rather than content',
        implementation: 'Thought observation, metaphors, mindfulness exercises',
        duration: '15-20 minutes',
        skillLevel: 'intermediate'
      },
      {
        name: 'Mindful Acceptance',
        description: 'Willingness to experience difficult emotions',
        implementation: 'Acceptance exercises, mindfulness practices',
        duration: '10-15 minutes',
        skillLevel: 'intermediate'
      },
      {
        name: 'Committed Action',
        description: 'Behavioral steps toward valued living',
        implementation: 'Goal setting, behavioral activation aligned with values',
        duration: '15-25 minutes',
        skillLevel: 'advanced'
      }
    ],
    evidenceBase: {
      level: 'strong',
      supportedConditions: ['Chronic pain', 'Anxiety disorders', 'Depression', 'Substance use', 'Workplace stress'],
      researchSummary: 'Growing evidence base with over 200 RCTs. Particularly effective for chronic conditions and life transitions.',
      effectivenessRating: 7
    },
    clientPopulations: ['Adults', 'Adolescents', 'Chronic illness', 'Workplace settings', 'Group formats'],
    sessionStructure: {
      typicalLength: '50-60 minutes',
      frequency: 'Weekly or bi-weekly',
      duration: '8-16 sessions',
      phases: ['Values exploration', 'Acceptance training', 'Defusion skills', 'Committed action']
    },
    requiredTraining: {
      level: 'intermediate',
      certificationRequired: false,
      prerequisites: ['Basic therapy skills', 'Understanding of mindfulness', 'ACT training workshop'],
      recommendedHours: 32
    },
    contraindications: ['Active psychosis', 'Severe depression with suicidal ideation', 'Cognitive impairment affecting insight'],
    culturalConsiderations: ['Collectivist values integration', 'Religious/spiritual compatibility', 'Language metaphors', 'Cultural concepts of acceptance'],
    integration: {
      combinesWith: ['Mindfulness-based interventions', 'CBT techniques', 'Somatic approaches'],
      commonAdaptations: ['ACT for chronic pain', 'ACT for workplace stress', 'Group ACT protocols']
    }
  },
  {
    id: 'psychodynamic',
    name: 'Psychodynamic Therapy',
    acronym: 'PDT',
    category: 'psychodynamic',
    description: 'Insight-oriented therapy exploring unconscious processes and past experiences',
    foundationalPrinciples: [
      'Unconscious processes influence behavior',
      'Past experiences shape present relationships',
      'Therapeutic relationship as vehicle for change',
      'Defense mechanisms and resistance',
      'Transference and countertransference dynamics'
    ],
    keyTechniques: [
      {
        name: 'Free Association',
        description: 'Expressing thoughts without censorship',
        implementation: 'Encourage spontaneous verbal expression',
        duration: '15-20 minutes',
        skillLevel: 'intermediate'
      },
      {
        name: 'Dream Analysis',
        description: 'Exploring unconscious content through dreams',
        implementation: 'Discuss dream content and associations',
        duration: '20-30 minutes',
        skillLevel: 'advanced'
      },
      {
        name: 'Transference Interpretation',
        description: 'Analyzing client-therapist relationship patterns',
        implementation: 'Identify and explore relationship patterns',
        duration: '10-15 minutes',
        skillLevel: 'advanced'
      },
      {
        name: 'Defense Mechanism Analysis',
        description: 'Identifying and understanding psychological defenses',
        implementation: 'Observe and gently challenge defenses',
        duration: '15-25 minutes',
        skillLevel: 'advanced'
      }
    ],
    evidenceBase: {
      level: 'moderate',
      supportedConditions: ['Depression', 'Personality disorders', 'Relationship issues', 'Complex trauma', 'Identity concerns'],
      researchSummary: 'Solid evidence base for depression and personality disorders. Long-term benefits demonstrated in multiple studies.',
      effectivenessRating: 6
    },
    clientPopulations: ['Adults', 'Adolescents', 'Individual therapy', 'Long-term treatment candidates'],
    sessionStructure: {
      typicalLength: '45-50 minutes',
      frequency: 'Weekly or twice weekly',
      duration: '1-3 years or longer',
      phases: ['Assessment and alliance building', 'Exploration and insight', 'Working through', 'Termination']
    },
    requiredTraining: {
      level: 'advanced',
      certificationRequired: true,
      prerequisites: ['Graduate training', 'Personal analysis', 'Supervised practice'],
      recommendedHours: 200
    },
    contraindications: ['Active psychosis', 'Severe personality disorders', 'Crisis situations', 'Poor reality testing'],
    culturalConsiderations: ['Western individualistic framework', 'Family dynamics', 'Cultural concepts of self', 'Religious beliefs'],
    integration: {
      combinesWith: ['Attachment theory', 'Trauma-informed approaches', 'Mindfulness'],
      commonAdaptations: ['Brief psychodynamic therapy', 'Interpersonal therapy', 'Mentalization-based therapy']
    }
  },
  {
    id: 'humanistic',
    name: 'Person-Centered Therapy',
    acronym: 'PCT',
    category: 'humanistic',
    description: 'Client-centered approach emphasizing empathy, genuineness, and unconditional positive regard',
    foundationalPrinciples: [
      'Inherent human tendency toward growth',
      'Client as expert on their own experience',
      'Therapist provides core conditions',
      'Non-directive approach',
      'Emphasis on here-and-now experience'
    ],
    keyTechniques: [
      {
        name: 'Active Listening',
        description: 'Empathetic reflection and understanding',
        implementation: 'Reflect feelings and meanings',
        duration: 'Throughout session',
        skillLevel: 'beginner'
      },
      {
        name: 'Unconditional Positive Regard',
        description: 'Non-judgmental acceptance of client',
        implementation: 'Demonstrate acceptance and warmth',
        duration: 'Throughout session',
        skillLevel: 'beginner'
      },
      {
        name: 'Genuineness',
        description: 'Authentic therapeutic presence',
        implementation: 'Be real and authentic in relationship',
        duration: 'Throughout session',
        skillLevel: 'intermediate'
      },
      {
        name: 'Process Reflection',
        description: 'Reflecting client\'s emotional process',
        implementation: 'Focus on feeling and experiencing',
        duration: '5-10 minutes',
        skillLevel: 'intermediate'
      }
    ],
    evidenceBase: {
      level: 'moderate',
      supportedConditions: ['Depression', 'Anxiety', 'Self-esteem issues', 'Personal growth', 'Relationship concerns'],
      researchSummary: 'Strong evidence for therapeutic relationship factors. Effective for various conditions when core conditions present.',
      effectivenessRating: 6
    },
    clientPopulations: ['Adults', 'Adolescents', 'Group therapy', 'Personal growth seekers'],
    sessionStructure: {
      typicalLength: '50 minutes',
      frequency: 'Weekly',
      duration: 'Variable, client-determined',
      phases: ['Relationship building', 'Exploration and insight', 'Integration and growth']
    },
    requiredTraining: {
      level: 'basic',
      certificationRequired: false,
      prerequisites: ['Basic counseling training', 'Understanding of core conditions'],
      recommendedHours: 24
    },
    contraindications: ['Severe mental illness requiring structure', 'Crisis situations', 'Clients needing specific skill training'],
    culturalConsiderations: ['Individual vs. collective cultures', 'Authority relationships', 'Expression of emotions', 'Family involvement'],
    integration: {
      combinesWith: ['Experiential techniques', 'Mindfulness approaches', 'Gestalt therapy'],
      commonAdaptations: ['Emotion-focused therapy', 'Experiential therapy', 'Play therapy for children']
    }
  }
]

function filterFrameworks(
  frameworks: TherapeuticFramework[],
  query?: string,
  category?: string,
  evidenceLevel?: string,
  clientPopulation?: string,
  issue?: string
): TherapeuticFramework[] {
  let filtered = [...frameworks]

  if (query) {
    const searchTerms = query.toLowerCase().split(' ')
    filtered = filtered.filter(framework => 
      searchTerms.every(term =>
        framework.name.toLowerCase().includes(term) ||
        framework.acronym.toLowerCase().includes(term) ||
        framework.description.toLowerCase().includes(term) ||
        framework.foundationalPrinciples.some(principle => principle.toLowerCase().includes(term))
      )
    )
  }

  if (category && category !== 'all') {
    filtered = filtered.filter(framework => framework.category === category)
  }

  if (evidenceLevel && evidenceLevel !== 'all') {
    filtered = filtered.filter(framework => framework.evidenceBase.level === evidenceLevel)
  }

  if (clientPopulation) {
    filtered = filtered.filter(framework => 
      framework.clientPopulations.some(pop => 
        pop.toLowerCase().includes(clientPopulation.toLowerCase())
      )
    )
  }

  if (issue) {
    filtered = filtered.filter(framework => 
      framework.evidenceBase.supportedConditions.some(condition => 
        condition.toLowerCase().includes(issue.toLowerCase())
      )
    )
  }

  return filtered
}

function getUniqueCategories(frameworks: TherapeuticFramework[]): string[] {
  return [...new Set(frameworks.map(f => f.category))].sort()
}

export const GET = async ({ url }: { url: URL }) => {
  try {
    const { searchParams } = url
    const query = searchParams.get('query') || undefined
    const category = searchParams.get('category') || 'all'
    const evidenceLevel = searchParams.get('evidenceLevel') || 'all'
    const clientPopulation = searchParams.get('clientPopulation') || undefined
    const issue = searchParams.get('issue') || undefined

    const filteredFrameworks = filterFrameworks(
      THERAPEUTIC_FRAMEWORKS,
      query,
      category,
      evidenceLevel,
      clientPopulation,
      issue
    )

    const response: FrameworksResponse = {
      frameworks: filteredFrameworks,
      totalCount: THERAPEUTIC_FRAMEWORKS.length,
      filteredCount: filteredFrameworks.length,
      categories: getUniqueCategories(THERAPEUTIC_FRAMEWORKS),
      metadata: {
        searchQuery: query,
        appliedFilters: {
          category: category === 'all' ? '' : category,
          evidenceLevel: evidenceLevel === 'all' ? '' : evidenceLevel,
          clientPopulation: clientPopulation || '',
          issue: issue || ''
        },
        generatedAt: new Date().toISOString()
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Total-Frameworks': THERAPEUTIC_FRAMEWORKS.length.toString(),
        'X-Filtered-Count': filteredFrameworks.length.toString()
      }
    })

  } catch (error: unknown) {
    console.error('Psychology frameworks error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error retrieving frameworks',
      details: error instanceof Error ? String(error) : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const POST = async ({ request }: APIContext) => {
  try {
    const body: FrameworksRequest = await request.json()

    const filteredFrameworks = filterFrameworks(
      THERAPEUTIC_FRAMEWORKS,
      body.query,
      body.category,
      body.evidenceLevel,
      body.clientPopulation,
      body.issue
    )

    const response: FrameworksResponse = {
      frameworks: filteredFrameworks,
      totalCount: THERAPEUTIC_FRAMEWORKS.length,
      filteredCount: filteredFrameworks.length,
      categories: getUniqueCategories(THERAPEUTIC_FRAMEWORKS),
      metadata: {
        searchQuery: body.query,
        appliedFilters: {
          category: body.category || '',
          evidenceLevel: body.evidenceLevel || '',
          clientPopulation: body.clientPopulation || '',
          issue: body.issue || ''
        },
        generatedAt: new Date().toISOString()
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Total-Frameworks': THERAPEUTIC_FRAMEWORKS.length.toString(),
        'X-Filtered-Count': filteredFrameworks.length.toString()
      }
    })

  } catch (error: unknown) {
    console.error('Psychology frameworks error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error retrieving frameworks',
      details: error instanceof Error ? String(error) : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
