import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EducationalContextRecognizer, EducationalType, TopicArea, ResourceType, UserProfile } from '@/lib/metaaligner/prioritization/educational-context-recognizer'
import type { AIService } from '@/lib/ai/models/types'

const mockAIService: AIService = {
  createChatCompletion: vi.fn().mockResolvedValue({ choices: [{ message: { content: '{}' } }] }),
  getModelInfo: vi.fn().mockResolvedValue({}),
  createChatStream: vi.fn(),
}

describe('EducationalContextRecognizer', () => {
  let recognizer: EducationalContextRecognizer

  beforeEach(() => {
    recognizer = new EducationalContextRecognizer({
      aiService: mockAIService,
      model: 'gpt-4',
      includeResourceRecommendations: true,
      adaptToUserLevel: true,
      enableTopicMapping: true,
    })
  })

  describe('Pattern-based Recognition', () => {
    it('should recognize definition queries', async () => {
      const result = await recognizer.recognizeEducationalContext('What is depression?')
      
      expect(result.isEducational).toBe(true)
      expect(result.educationalType).toBe(EducationalType.DEFINITION)
      expect(result.topicArea).toBe(TopicArea.DEPRESSION)
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should recognize explanation queries', async () => {
      const result = await recognizer.recognizeEducationalContext('How does therapy work?')
      
      expect(result.isEducational).toBe(true)
      expect(result.educationalType).toBe(EducationalType.EXPLANATION)
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should recognize symptom queries', async () => {
      const result = await recognizer.recognizeEducationalContext('What are the symptoms of anxiety?')
      
      expect(result.isEducational).toBe(true)
      expect(result.educationalType).toBe(EducationalType.SYMPTOMS)
      expect(result.topicArea).toBe(TopicArea.ANXIETY)
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should recognize treatment queries', async () => {
      const result = await recognizer.recognizeEducationalContext('What are treatment options for depression?')
      
      expect(result.isEducational).toBe(true)
      expect(result.educationalType).toBe(EducationalType.TREATMENT)
      expect(result.topicArea).toBe(TopicArea.DEPRESSION)
      expect(result.confidence).toBeGreaterThan(0.5)
    })

    it('should recognize complex queries', async () => {
      const result = await recognizer.recognizeEducationalContext('How does neurobiology contribute to depression?')
      
      expect(result.isEducational).toBe(true)
      expect(result.complexity).toBe('advanced')
      expect(result.confidence).toBeGreaterThan(0.5)
    })
  })

  describe('AI Integration', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should fall back to pattern-based recognition when AI fails', async () => {
      vi.spyOn(mockAIService, 'createChatCompletion').mockRejectedValueOnce(new Error('AI service unavailable'))
      
      const result = await recognizer.recognizeEducationalContext('What is anxiety?')
      
      expect(result.isEducational).toBe(true)
      expect(result.educationalType).toBe(EducationalType.DEFINITION)
    })

    it('should use AI results when available', async () => {
      vi.spyOn(mockAIService, 'createChatCompletion').mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify({
              isEducational: true,
              confidence: 0.9,
              educationalType: 'explanation',
              complexity: 'intermediate',
              topicArea: 'anxiety',
              learningObjectives: ['Understand anxiety mechanisms'],
              recommendedResources: ['educational_videos', 'books'],
              priorKnowledgeRequired: [],
              metadata: {
                conceptualDepth: 0.7,
                practicalApplications: ['stress management'],
                relatedTopics: ['depression', 'ptsd']
              }
            })
          }
        }]
      })
      
      const result = await recognizer.recognizeEducationalContext('How does anxiety develop?')
      
      expect(result.isEducational).toBe(true)
      expect(result.confidence).toBeGreaterThan(0.8)
      expect(result.learningObjectives).toHaveLength(1)
    })
  })

  describe('User Profile Adaptation', () => {
    it('should adapt complexity for user level', async () => {
      const userProfile: UserProfile = {
        educationLevel: 'graduate',
        priorMentalHealthKnowledge: 'advanced'
      }
      
      const result = await recognizer.recognizeEducationalContext('How does neurobiology contribute to depression?', userProfile)
      
      expect(result.complexity).toBe('advanced')
    })

    it('should adapt resources for learning style', async () => {
      const userProfile: UserProfile = {
        preferredLearningStyle: 'visual'
      }
      
      const result = await recognizer.recognizeEducationalContext('What is depression?', userProfile)
      
      expect(result.recommendedResources).toContain(ResourceType.INFOGRAPHICS)
      expect(result.recommendedResources).toContain(ResourceType.EDUCATIONAL_VIDEOS)
    })
  })

  describe('Batch Processing', () => {
    it('should process multiple queries in batch', async () => {
      const queries = [
        { query: 'What is depression?' },
        { query: 'How does therapy work?' },
        { query: 'What are symptoms of anxiety?' }
      ]
      
      const results = await recognizer.recognizeBatch(queries)
      
      expect(results).toHaveLength(3)
      expect(results.every(r => r.isEducational)).toBe(true)
    })
  })

  describe('Edge Cases', () => {
    it('should handle non-educational queries gracefully', async () => {
      const result = await recognizer.recognizeEducationalContext('I need help now')
      
      expect(result.isEducational).toBe(false)
      expect(result.confidence).toBeLessThan(0.5)
    })

    it('should handle empty or invalid inputs', async () => {
      const result = await recognizer.recognizeEducationalContext('')
      
      expect(result.isEducational).toBe(false)
      expect(result.confidence).toBeLessThan(0.5)
    })
  })
})
