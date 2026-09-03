/**
 * Educational context recognition type definitions.
 * Extracted from educational-context-recognizer.ts.
 */

import type { AIService } from '../../ai/models/ai-types'

export interface EducationalContextResult {
  isEducational: boolean
  confidence: number
  educationalType: EducationalType
  complexity: 'basic' | 'intermediate' | 'advanced'
  topicArea: TopicArea
  learningObjectives: string[]
  recommendedResources: ResourceType[]
  priorKnowledgeRequired: string[]
  metadata: {
    conceptualDepth: number // 0-1 scale
    practicalApplications: string[]
    relatedTopics: string[]
    ageAppropriateness?: 'child' | 'adolescent' | 'adult' | 'all'
    [key: string]: unknown
  }
}

export enum EducationalType {
  DEFINITION = 'definition', // "What is depression?"
  EXPLANATION = 'explanation', // "How does therapy work?"
  COMPARISON = 'comparison', // "What's the difference between anxiety and panic attacks?"
  MECHANISM = 'mechanism', // "Why do antidepressants take time to work?"
  SYMPTOMS = 'symptoms', // "What are the symptoms of PTSD?"
  CAUSES = 'causes', // "What causes bipolar disorder?"
  TREATMENT = 'treatment', // "What are treatment options for anxiety?"
  PREVENTION = 'prevention', // "How can I prevent panic attacks?"
  RESEARCH = 'research', // "What does research say about CBT?"
  STATISTICS = 'statistics', // "How common is depression?"
  MYTH_BUSTING = 'myth_busting', // "Is it true that..."
  DEVELOPMENTAL = 'developmental', // "How does depression affect children?"
}

export enum TopicArea {
  DEPRESSION = 'depression',
  ANXIETY = 'anxiety',
  TRAUMA_PTSD = 'trauma_ptsd',
  BIPOLAR = 'bipolar',
  PERSONALITY_DISORDERS = 'personality_disorders',
  EATING_DISORDERS = 'eating_disorders',
  ADDICTION = 'addiction',
  THERAPY = 'therapy',
  MEDICATION = 'medication',
  COPING_SKILLS = 'coping_skills',
  RELATIONSHIPS = 'relationships',
  STIGMA = 'stigma',
  NEURODEVELOPMENTAL = 'neurodevelopmental',
  GENERAL_MENTAL_HEALTH = 'general_mental_health',
}

export enum ResourceType {
  SCIENTIFIC_ARTICLES = 'scientific_articles',
  EDUCATIONAL_VIDEOS = 'educational_videos',
  INTERACTIVE_TOOLS = 'interactive_tools',
  BOOKS = 'books',
  INFOGRAPHICS = 'infographics',
  WORKSHEETS = 'worksheets',
  SELF_ASSESSMENT = 'self_assessment',
  PODCASTS = 'podcasts',
  ONLINE_COURSES = 'online_courses',
  SUPPORT_GROUPS = 'support_groups',
}

export interface EducationalRecognizerConfig {
  aiService: AIService
  model?: string
  includeResourceRecommendations?: boolean
  adaptToUserLevel?: boolean
  enableTopicMapping?: boolean
}

export interface UserProfile {
  educationLevel?: 'high_school' | 'undergraduate' | 'graduate' | 'professional'
  priorMentalHealthKnowledge?: 'none' | 'basic' | 'intermediate' | 'advanced'
  preferredLearningStyle?: 'visual' | 'auditory' | 'kinesthetic' | 'reading'
}
