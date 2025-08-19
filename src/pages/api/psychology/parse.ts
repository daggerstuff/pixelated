export const prerender = false

export interface ParseRequest {
  content: string
  type: 'clinical_note' | 'research_paper' | 'case_study' | 'therapy_session'
  options?: {
    extractEntities?: boolean
    identifyFrameworks?: boolean
    generateSummary?: boolean
  }
}

export interface ParseResponse {
  entities: {
    conditions: string[]
    treatments: string[]
    medications: string[]
    symptoms: string[]
    riskFactors: string[]
  }
  frameworks: {
    name: string
    confidence: number
    applicability: string
    techniques: string[]
  }[]
  summary: string
  confidence: number
  processingTime: number
  metadata: {
    wordCount: number
    complexity: 'low' | 'medium' | 'high'
    clinicalRelevance: number
  }
}

// Comprehensive clinical frameworks database
const THERAPEUTIC_FRAMEWORKS = [
  {
    name: 'Cognitive Behavioral Therapy (CBT)',
    techniques: ['Cognitive restructuring', 'Behavioral activation', 'Exposure therapy', 'Thought records'],
    conditions: ['anxiety', 'depression', 'PTSD', 'OCD', 'panic disorder'],
    evidence: 'extensive',
    description: 'Evidence-based approach focusing on thoughts, feelings, and behaviors'
  },
  {
    name: 'Dialectical Behavior Therapy (DBT)',
    techniques: ['Mindfulness', 'Distress tolerance', 'Emotion regulation', 'Interpersonal effectiveness'],
    conditions: ['borderline personality disorder', 'self-harm', 'emotional dysregulation'],
    evidence: 'strong',
    description: 'Skills-based therapy for emotional regulation and interpersonal challenges'
  },
  {
    name: 'Acceptance and Commitment Therapy (ACT)',
    techniques: ['Psychological flexibility', 'Values clarification', 'Mindfulness', 'Defusion'],
    conditions: ['anxiety', 'depression', 'chronic pain', 'substance abuse'],
    evidence: 'growing',
    description: 'Focus on psychological flexibility and values-based living'
  },
  {
    name: 'Psychodynamic Therapy',
    techniques: ['Free association', 'Transference analysis', 'Dream interpretation', 'Defense mechanisms'],
    conditions: ['personality disorders', 'relationship issues', 'depression'],
    evidence: 'moderate',
    description: 'Insight-oriented therapy exploring unconscious patterns'
  },
  {
    name: 'Trauma-Focused CBT',
    techniques: ['Trauma narrative', 'Cognitive processing', 'Exposure therapy', 'EMDR'],
    conditions: ['PTSD', 'complex trauma', 'childhood abuse'],
    evidence: 'extensive',
    description: 'Specialized CBT approach for trauma-related conditions'
  }
]

// Clinical entity extraction patterns
const ENTITY_PATTERNS = {
  conditions: [
    'anxiety', 'depression', 'PTSD', 'OCD', 'bipolar', 'schizophrenia', 'ADHD',
    'borderline personality disorder', 'narcissistic personality disorder',
    'eating disorder', 'substance abuse', 'addiction', 'panic disorder',
    'social anxiety', 'generalized anxiety', 'major depressive disorder'
  ],
  symptoms: [
    'insomnia', 'fatigue', 'irritability', 'mood swings', 'panic attacks',
    'flashbacks', 'nightmares', 'hypervigilance', 'dissociation',
    'anhedonia', 'hopelessness', 'suicidal ideation', 'self-harm'
  ],
  treatments: [
    'CBT', 'DBT', 'EMDR', 'psychotherapy', 'medication', 'group therapy',
    'family therapy', 'exposure therapy', 'mindfulness', 'meditation'
  ],
  medications: [
    'sertraline', 'fluoxetine', 'escitalopram', 'venlafaxine', 'bupropion',
    'aripiprazole', 'quetiapine', 'lithium', 'lamotrigine', 'clonazepam'
  ],
  riskFactors: [
    'family history', 'trauma', 'substance abuse', 'social isolation',
    'financial stress', 'relationship problems', 'chronic illness'
  ]
}

function extractEntities(content: string): ParseResponse['entities'] {
  const lowerContent = content.toLowerCase()
  const entities: ParseResponse['entities'] = {
    conditions: [],
    treatments: [],
    medications: [],
    symptoms: [],
    riskFactors: []
  }

  for (const [category, patterns] of Object.entries(ENTITY_PATTERNS)) {
    const found = patterns.filter(pattern => 
      lowerContent.includes(pattern.toLowerCase())
    )
    entities[category as keyof typeof entities] = found
  }

  return entities
}

function identifyFrameworks(content: string, entities: ParseResponse['entities']): ParseResponse['frameworks'] {
  const frameworks: ParseResponse['frameworks'] = []
  const lowerContent = content.toLowerCase()

  for (const framework of THERAPEUTIC_FRAMEWORKS) {
    let confidence = 0
    let applicability = ''

    // Check for direct mentions
    if (lowerContent.includes(framework.name.toLowerCase())) {
      confidence += 0.4
    }

    // Check for technique mentions
    const mentionedTechniques = framework.techniques.filter(technique =>
      lowerContent.includes(technique.toLowerCase())
    )
    confidence += mentionedTechniques.length * 0.1

    // Check for condition applicability
    const applicableConditions = framework.conditions.filter(condition =>
      entities.conditions.some(entityCondition => 
        entityCondition.toLowerCase().includes(condition.toLowerCase())
      )
    )
    confidence += applicableConditions.length * 0.15

    // Determine applicability
    if (confidence > 0.6) {
      applicability = 'highly recommended'
    } else if (confidence > 0.3) {
      applicability = 'potentially useful'
    } else if (confidence > 0.1) {
      applicability = 'consider'
    }

    if (confidence > 0.1) {
      frameworks.push({
        name: framework.name,
        confidence: Math.min(confidence, 0.95),
        applicability,
        techniques: mentionedTechniques.length > 0 ? mentionedTechniques : framework.techniques.slice(0, 3)
      })
    }
  }

  return frameworks.sort((a, b) => b.confidence - a.confidence).slice(0, 5)
}

function generateSummary(content: string, entities: ParseResponse['entities']): string {
  const conditionCount = entities.conditions.length
  const treatmentCount = entities.treatments.length
  const wordCount = content.split(/\s+/).length

  if (conditionCount === 0 && treatmentCount === 0) {
    return `This content appears to be general psychological material without specific clinical focus. (Word count: ${wordCount})`
  }

  let summary = `Clinical content analysis reveals `

  if (conditionCount > 0) {
    summary += `${conditionCount} mental health condition${conditionCount > 1 ? 's' : ''} identified: ${entities.conditions.slice(0, 3).join(', ')}`
    if (entities.conditions.length > 3) {
      summary += ` and others`
    }
    summary += '. '
  }

  if (treatmentCount > 0) {
    summary += `Treatment approaches mentioned include ${entities.treatments.slice(0, 3).join(', ')}`
    if (entities.treatments.length > 3) {
      summary += ` among others`
    }
    summary += '. '
  }

  if (entities.symptoms.length > 0) {
    summary += `Key symptoms identified: ${entities.symptoms.slice(0, 3).join(', ')}. `
  }

  summary += `(Word count: ${wordCount})`

  return summary
}

function calculateComplexity(content: string, entities: ParseResponse['entities']): 'low' | 'medium' | 'high' {
  const wordCount = content.split(/\s+/).length
  const entityCount = Object.values(entities).flat().length
  const uniqueWords = new Set(content.toLowerCase().split(/\s+/)).size
  const complexity = (entityCount * 2 + uniqueWords / wordCount * 100) / 3

  if (complexity > 50) {
    return 'high'
  }
  if (complexity > 25) {
    return 'medium'
  }
  return 'low'
}

export const POST = async ({ request }: APIContext) => {
  const startTime = Date.now()

  try {
    const body: ParseRequest = await request.json()
    
    if (!body.content || typeof body.content !== 'string') {
      return new Response(JSON.stringify({ 
        error: 'Invalid request: content is required and must be a string' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (body.content.length < 10) {
      return new Response(JSON.stringify({ 
        error: 'Content too short: minimum 10 characters required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (body.content.length > 50000) {
      return new Response(JSON.stringify({ 
        error: 'Content too long: maximum 50,000 characters allowed' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const options = {
      extractEntities: true,
      identifyFrameworks: true,
      generateSummary: true,
      ...body.options
    }

    // Extract clinical entities
    const entities = options.extractEntities ? extractEntities(body.content) : {
      conditions: [],
      treatments: [],
      medications: [],
      symptoms: [],
      riskFactors: []
    }

    // Identify applicable frameworks
    const frameworks = options.identifyFrameworks ? identifyFrameworks(body.content, entities) : []

    // Generate summary
    const summary = options.generateSummary ? generateSummary(body.content, entities) : ''

    // Calculate confidence based on entity richness and content quality
    const entityCount = Object.values(entities).flat().length
    const wordCount = body.content.split(/\s+/).length
    const confidence = Math.min(0.95, Math.max(0.1, (entityCount * 10 + wordCount * 0.01) / 100))

    // Calculate clinical relevance
    const clinicalTerms = ['patient', 'client', 'therapy', 'treatment', 'diagnosis', 'symptom', 'intervention']
    const clinicalMentions = clinicalTerms.filter(term => 
      body.content.toLowerCase().includes(term)
    ).length
    const clinicalRelevance = Math.min(1.0, clinicalMentions / clinicalTerms.length)

    const processingTime = Date.now() - startTime

    const response: ParseResponse = {
      entities,
      frameworks,
      summary,
      confidence,
      processingTime,
      metadata: {
        wordCount,
        complexity: calculateComplexity(body.content, entities),
        clinicalRelevance
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-Processing-Time': processingTime.toString()
      }
    })

  } catch (error: unknown) {
    console.error('Psychology parse API error:', error)
    return new Response(JSON.stringify({ 
      error: 'Internal server error during content analysis',
      details: error instanceof Error ? String(error) : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
