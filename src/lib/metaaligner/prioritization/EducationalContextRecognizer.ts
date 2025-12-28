/**
 * Simplified EducationalContextRecognizer
 * Focuses on reliable pattern matching with optional AI enhancement
 */

export enum EducationalType {
  DEFINITION = 'definition',
  EXPLANATION = 'explanation',
  COMPARISON = 'comparison',
  SYMPTOMS = 'symptoms',
  RESEARCH = 'research',
}

export enum TopicArea {
  DEPRESSION = 'depression',
  ANXIETY = 'anxiety',
  THERAPY = 'therapy',
  MEDICATION = 'medication',
  GENERAL_MENTAL_HEALTH = 'general_mental_health',
}

export enum ResourceType {
  EDUCATIONAL_VIDEOS = 'educational_videos',
  INFOGRAPHICS = 'infographics',
  SCIENTIFIC_ARTICLES = 'scientific_articles',
  INTERACTIVE_TOOLS = 'interactive_tools',
  BOOKS = 'books',
  PODCASTS = 'podcasts',
}

export interface EducationalRecognizerConfig {
  aiService?: unknown
  model?: string
  includeResourceRecommendations?: boolean
  adaptToUserLevel?: boolean
  enableTopicMapping?: boolean
}

export interface EducationalContextResult {
  isEducational: boolean
  confidence: number
  educationalType: EducationalType
  complexity: string
  topicArea: TopicArea
  learningObjectives: string[]
  recommendedResources: ResourceType[]
  priorKnowledgeRequired: string[]
  metadata: Record<string, unknown>
}

// Pattern matching for educational content
const EDUCATIONAL_PATTERNS = {
  [EducationalType.DEFINITION]: [
    /\b(?:what is|what are|define|definition of|meaning of|tell me about)\b/i,
  ],
  [EducationalType.EXPLANATION]: [
    /\b(?:how does|how do|how to|why|explain|explanation|work)\b/i,
  ],
  [EducationalType.COMPARISON]: [
    /\b(?:difference|compare|versus|vs|which is better|comparison)\b/i,
  ],
  [EducationalType.SYMPTOMS]: [
    /\b(?:symptom|symptoms|sign|signs|warning|how do i know|indicators)\b/i,
  ],
  [EducationalType.RESEARCH]: [
    /\b(?:research|latest|studies|study|findings)\b/i,
  ],
}

// Topic keywords for classification
const TOPIC_KEYWORDS = {
  [TopicArea.DEPRESSION]: ['depression', 'mood disorder', 'depressed'],
  [TopicArea.ANXIETY]: ['anxiety', 'panic', 'anxious'],
  [TopicArea.THERAPY]: ['therapy', 'cbt', 'dbt', 'counseling'],
  [TopicArea.MEDICATION]: ['medication', 'antidepressant', 'drug'],
  [TopicArea.GENERAL_MENTAL_HEALTH]: ['mental health', 'ptsd', 'bipolar'],
}

function matchEducationalType(query: string): {
  type: EducationalType | null
  confidence: number
} {
  const lower = query.toLowerCase()

  for (const [type, patterns] of Object.entries(EDUCATIONAL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) {
        return { type: type as EducationalType, confidence: 0.8 }
      }
    }
  }

  return { type: null, confidence: 0.1 }
}

function matchTopicArea(query: string): TopicArea {
  const lower = query.toLowerCase()

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return topic as TopicArea
    }
  }

  return TopicArea.GENERAL_MENTAL_HEALTH
}

export class EducationalContextRecognizer {
  private config: EducationalRecognizerConfig

  constructor(config: EducationalRecognizerConfig = {}) {
    this.config = {
      model: config.model ?? 'gpt-4',
      includeResourceRecommendations:
        config.includeResourceRecommendations ?? true,
      adaptToUserLevel: config.adaptToUserLevel ?? true,
      enableTopicMapping: config.enableTopicMapping ?? true,
      aiService: config.aiService,
    }
  }

  async recognizeEducationalContext(
    query: string,
    userProfile?: Record<string, unknown>,
  ): Promise<EducationalContextResult> {
    // Step 1: Pattern-based recognition
    const { type, confidence: patternConfidence } = matchEducationalType(query)
    const topicArea = this.config.enableTopicMapping
      ? matchTopicArea(query)
      : TopicArea.GENERAL_MENTAL_HEALTH

    // If no educational pattern found, return non-educational result
    if (!type) {
      return this.createNonEducationalResult()
    }

    let finalResult: EducationalContextResult = {
      isEducational: true,
      confidence: patternConfidence,
      educationalType: type,
      complexity: 'basic',
      topicArea,
      learningObjectives: [`Learn about ${topicArea.replace('_', ' ')}`],
      recommendedResources: this.getDefaultResources(type),
      priorKnowledgeRequired: [],
      metadata: {
        conceptualDepth: patternConfidence * 0.8,
        practicalApplications: [],
        relatedTopics: [],
      },
    }

    // Step 2: AI enhancement (if available and pattern confidence is high)
    if (this.config.aiService && patternConfidence > 0.7) {
      try {
        const aiResult = await this.performAIAnalysis(
          query,
          userProfile,
          type,
          topicArea,
        )
        if (aiResult) {
          finalResult = this.combineResults(finalResult, aiResult)
        }
      } catch (error: unknown) {
        // Continue with pattern-based result if AI fails
        console.warn('AI analysis failed, using pattern-based result:', error)
      }
    }

    // Step 3: User profile adaptation
    if (userProfile && this.config.adaptToUserLevel) {
      finalResult = this.adaptToUserProfile(finalResult, userProfile)
    }

    return finalResult
  }

  private createNonEducationalResult(): EducationalContextResult {
    return {
      isEducational: false,
      confidence: 0.1,
      educationalType: EducationalType.DEFINITION,
      complexity: 'basic',
      topicArea: TopicArea.GENERAL_MENTAL_HEALTH,
      learningObjectives: [],
      recommendedResources: [],
      priorKnowledgeRequired: [],
      metadata: {
        conceptualDepth: 0.1,
        practicalApplications: [],
        relatedTopics: [],
      },
    }
  }

  private getDefaultResources(type: EducationalType): ResourceType[] {
    const resourceMap: Record<EducationalType, ResourceType[]> = {
      [EducationalType.DEFINITION]: [
        ResourceType.EDUCATIONAL_VIDEOS,
        ResourceType.INFOGRAPHICS,
      ],
      [EducationalType.EXPLANATION]: [
        ResourceType.EDUCATIONAL_VIDEOS,
        ResourceType.INTERACTIVE_TOOLS,
      ],
      [EducationalType.COMPARISON]: [
        ResourceType.INFOGRAPHICS,
        ResourceType.SCIENTIFIC_ARTICLES,
      ],
      [EducationalType.SYMPTOMS]: [
        ResourceType.INFOGRAPHICS,
        ResourceType.EDUCATIONAL_VIDEOS,
      ],
      [EducationalType.RESEARCH]: [
        ResourceType.SCIENTIFIC_ARTICLES,
        ResourceType.BOOKS,
      ],
    }

    return resourceMap[type] || [ResourceType.EDUCATIONAL_VIDEOS]
  }

  private async performAIAnalysis(
    query: string,
    userProfile: Record<string, unknown> | undefined,
    type: EducationalType,
    topicArea: TopicArea,
  ): Promise<EducationalContextResult | null> {
    if (!this.config.aiService) {
      return null
    }

    const messages = [
      {
        role: 'system',
        content:
          'You are an educational context analyzer. Return a JSON object with educational analysis.',
      },
      {
        role: 'user',
        content: `Analyze: "${query}". User: ${JSON.stringify(userProfile || {})}`,
      },
    ]

    const response = await this.config.aiService.createChatCompletion(
      messages,
      {
        model: this.config.model,
      },
    )

    const content = response?.choices?.[0]?.message?.content
    if (!content) {
      return null
    }

    try {
      const parsed = JSON.parse(content) as unknown
      return {
        isEducational: Boolean(parsed.isEducational),
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0.8)),
        educationalType: type, // Use pattern-detected type
        complexity: this.validateComplexity(parsed.complexity),
        topicArea, // Use pattern-detected topic
        learningObjectives: Array.isArray(parsed.learningObjectives)
          ? parsed.learningObjectives
          : [],
        recommendedResources: this.validateResources(
          parsed.recommendedResources,
        ),
        priorKnowledgeRequired: Array.isArray(parsed.priorKnowledgeRequired)
          ? parsed.priorKnowledgeRequired
          : [],
        metadata: {
          conceptualDepth: Math.max(
            0,
            Math.min(1, parsed.metadata?.conceptualDepth || 0.5),
          ),
          practicalApplications: Array.isArray(
            parsed.metadata?.practicalApplications,
          )
            ? parsed.metadata.practicalApplications
            : [],
          relatedTopics: Array.isArray(parsed.metadata?.relatedTopics)
            ? parsed.metadata.relatedTopics
            : [],
        },
      }
    } catch {
      return null
    }
  }

  private combineResults(
    patternResult: EducationalContextResult,
    aiResult: EducationalContextResult,
  ): EducationalContextResult {
    return {
      ...patternResult,
      confidence: Math.max(patternResult.confidence, aiResult.confidence),
      learningObjectives:
        aiResult.learningObjectives.length > 0
          ? aiResult.learningObjectives
          : patternResult.learningObjectives,
      recommendedResources:
        aiResult.recommendedResources.length > 0
          ? aiResult.recommendedResources
          : patternResult.recommendedResources,
      priorKnowledgeRequired: aiResult.priorKnowledgeRequired,
      metadata: {
        ...patternResult.metadata,
        ...aiResult.metadata,
      },
    }
  }

  private adaptToUserProfile(
    result: EducationalContextResult,
    userProfile: Record<string, unknown>,
  ): EducationalContextResult {
    const adapted = { ...result }

    // Adapt complexity based on education level
    if (
      (userProfile as { educationLevel?: string }).educationLevel === 'graduate'
    ) {
      adapted.complexity = 'advanced'
    } else if (
      (userProfile as { educationLevel?: string }).educationLevel ===
      'high_school'
    ) {
      adapted.complexity =
        result.complexity === 'advanced' ? 'intermediate' : 'basic'
    }

    // Adapt resources based on learning style
    if (
      (userProfile as { preferredLearningStyle?: string })
        .preferredLearningStyle === 'visual'
    ) {
      const resources = [...adapted.recommendedResources]
      if (!resources.includes(ResourceType.INFOGRAPHICS)) {
        resources.push(ResourceType.INFOGRAPHICS)
      }
      adapted.recommendedResources = resources
    }

    return adapted
  }

  private validateComplexity(complexity: string): string {
    return ['basic', 'intermediate', 'advanced'].includes(complexity)
      ? complexity
      : 'basic'
  }

  private validateResources(resources: unknown): ResourceType[] {
    if (!Array.isArray(resources)) {
      return []
    }
    return resources
      .filter((r) => Object.values(ResourceType).includes(r))
      .slice(0, 5) // Limit to 5 resources
  }

  async recognizeBatch(
    queries: { query: string }[],
  ): Promise<EducationalContextResult[]> {
    return Promise.all(
      queries.map((q) => this.recognizeEducationalContext(q.query)),
    )
  }

  generateLearningPathway(result: EducationalContextResult): any {
    return {
      currentTopic: `${result.educationalType} - ${result.topicArea}`,
      nextSteps: ['Learn about symptoms'],
      estimatedTimeToComplete: '15-30 minutes',
      relatedConcepts: result.metadata.relatedTopics || [],
    }
  }
}

export function createEducationalContextRecognizer(
  config: EducationalRecognizerConfig,
): EducationalContextRecognizer {
  return new EducationalContextRecognizer(config)
}

export function getDefaultEducationalRecognizerConfig(
  aiService: unknown,
): EducationalRecognizerConfig {
  return {
    aiService,
    model: 'gpt-4',
    includeResourceRecommendations: true,
    adaptToUserLevel: true,
    enableTopicMapping: true,
  }
}
