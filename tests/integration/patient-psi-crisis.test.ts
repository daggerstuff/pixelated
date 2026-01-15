import { describe, it, expect, beforeEach } from 'vitest'
import { ContextualEnhancer } from '../../src/lib/ai/services/contextual-enhancer'
import { RealTimeAnalyzer } from '../../src/lib/ai/services/real-time-analyzer'
import { EmotionState } from '../../src/lib/ai/types/emotional'
import { PatientPsiProfile } from '../../src/lib/ai/types/patient-psi'

describe('Patient-Psi Crisis Integration Tests', () => {
  let contextualEnhancer: ContextualEnhancer
  let _realTimeAnalyzer: RealTimeAnalyzer

  beforeEach(() => {
    contextualEnhancer = new ContextualEnhancer()
    _realTimeAnalyzer = new RealTimeAnalyzer()
  })

  describe('End-to-End Crisis Detection and Response', () => {
    it('should detect crisis and provide contextual intervention', async () => {
      const mockProfile: PatientPsiProfile = {
        id: 'test-patient-001',
        name: 'Test Patient',
        age: 25,
        gender: 'female',
        communicationStyle: {
          primary: 'anxious',
          patterns: ['avoidant', 'seeking reassurance'],
          triggers: ['criticism', 'abandonment'],
          preferredApproach: ['validation', 'gentle guidance'],
        },
        therapeuticGoals: ['reduce anxiety', 'improve coping'],
        culturalFactors: {
          primaryFactors: ['individualistic', 'western'],
          communicationPreferences: ['direct', 'text-based'],
        },
        presentingIssues: ['anxiety', 'depression'],
        history: ['trauma history', 'previous therapy'],
        preferences: {
          sessionLength: 50,
          communicationMethod: 'text',
          interventionStyle: 'gentle',
        },
        riskFactors: {
          suicideRisk: 0.3,
          selfHarm: 0.2,
          substanceUse: 0.1,
          traumaHistory: ['childhood trauma'],
        },
      }

      const crisisEmotion: EmotionState = {
        primary: 'anxiety',
        intensity: 0.9,
        valence: -0.8,
        arousal: 0.9,
        confidence: 0.95,
      }

      const conversationHistory = [
        "I'm feeling really overwhelmed right now",
        "Everything seems hopeless and I don't know what to do",
        "I've been having thoughts about ending it all",
      ]

      const result = await contextualEnhancer.enhanceContext(
        'test-session-001',
        crisisEmotion,
        mockProfile,
        conversationHistory,
      )

      expect(result.interventionTiming.shouldIntervene).toBe(true)
      expect(result.interventionTiming.urgency).toBe('immediate')
      expect(result.recommendations).toContain(
        'Activate crisis intervention protocol',
      )
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should track therapeutic progress over multiple sessions', async () => {
      const mockProfile: PatientPsiProfile = {
        id: 'test-patient-002',
        name: 'Progress Patient',
        age: 30,
        gender: 'male',
        communicationStyle: {
          primary: 'assertive',
          patterns: ['direct communication'],
          triggers: ['conflict'],
          preferredApproach: ['collaborative'],
        },
        therapeuticGoals: [
          'improve emotional regulation',
          'build coping skills',
        ],
        culturalFactors: {
          primaryFactors: ['collaborative'],
          communicationPreferences: ['direct'],
        },
        presentingIssues: ['anger management'],
        history: [],
        preferences: {
          sessionLength: 45,
          communicationMethod: 'text',
          interventionStyle: 'collaborative',
        },
        riskFactors: {
          suicideRisk: 0.1,
          selfHarm: 0.05,
          substanceUse: 0.0,
        },
      }

      // Simulate historical sessions showing improvement


      const currentEmotion: EmotionState = {
        primary: 'frustrated',
        intensity: 0.5,
        valence: -0.3,
        arousal: 0.6,
        confidence: 0.9,
      }

      const result = await contextualEnhancer.enhanceContext(
        'test-session-005',
        currentEmotion,
        mockProfile,
        [
          'I used the breathing technique we practiced',
          'It helped me stay calmer',
        ],
      )

      expect(result.progress.emotionalRegulation).toBeGreaterThan(0.5)
      expect(result.interventionTiming.urgency).toBe('routine')
    })
  })

  describe('Performance Benchmarks', () => {
    it('should complete contextual analysis within 100ms', async () => {
      const mockProfile: PatientPsiProfile = {
        id: 'test-patient-003',
        name: 'Performance Test',
        age: 28,
        gender: 'female',
        communicationStyle: {
          primary: 'anxious',
          patterns: [],
          triggers: [],
          preferredApproach: [],
        },
        therapeuticGoals: ['reduce anxiety'],
        culturalFactors: { primaryFactors: [] },
        presentingIssues: ['anxiety'],
        history: [],
        preferences: {
          sessionLength: 50,
          communicationMethod: 'text',
          interventionStyle: 'gentle',
        },
        riskFactors: {
          suicideRisk: 0.2,
          selfHarm: 0.1,
        },
      }

      const emotion: EmotionState = {
        primary: 'anxiety',
        intensity: 0.7,
        valence: -0.6,
        arousal: 0.8,
        confidence: 0.95,
      }

      const start = performance.now()

      await contextualEnhancer.enhanceContext(
        'perf-test-session',
        emotion,
        mockProfile,
        ['I am feeling anxious about work'],
      )

      const duration = performance.now() - start
      expect(duration).toBeLessThan(100)
    })

    it('should handle large conversation histories efficiently', async () => {
      const mockProfile: PatientPsiProfile = {
        id: 'test-patient-004',
        name: 'Large History Test',
        age: 35,
        gender: 'male',
        communicationStyle: {
          primary: 'assertive',
          patterns: [],
          triggers: [],
          preferredApproach: [],
        },
        therapeuticGoals: ['stress management'],
        culturalFactors: { primaryFactors: [] },
        presentingIssues: ['work stress'],
        history: [],
        preferences: {
          sessionLength: 50,
          communicationMethod: 'text',
          interventionStyle: 'direct',
        },
        riskFactors: {
          suicideRisk: 0.1,
          selfHarm: 0.0,
        },
      }

      // Generate large conversation history
      const largeHistory = Array.from(
        { length: 100 },
        (_, i) =>
          `Message ${i + 1}: This is a test conversation line for performance testing`,
      )

      const emotion: EmotionState = {
        primary: 'stressed',
        intensity: 0.6,
        valence: -0.4,
        arousal: 0.7,
        confidence: 0.9,
      }

      const start = performance.now()

      const result = await contextualEnhancer.enhanceContext(
        'large-history-session',
        emotion,
        mockProfile,
        largeHistory,
      )

      const duration = performance.now() - start
      expect(duration).toBeLessThan(200) // Allow more time for large histories
      expect(result.confidence).toBeGreaterThan(0.7)
    })
  })

  describe('Clinical Accuracy Validation', () => {
    it('should maintain high accuracy for crisis detection', async () => {
      const testCases = [
        {
          emotion: {
            primary: 'depression',
            intensity: 0.9,
            valence: -0.9,
            arousal: 0.3,
            confidence: 0.95,
          },
          conversation: [
            'I feel like giving up',
            'Life has no meaning anymore',
          ],
          expectedCrisis: true,
        },
        {
          emotion: {
            primary: 'anxiety',
            intensity: 0.4,
            valence: -0.3,
            arousal: 0.5,
            confidence: 0.9,
          },
          conversation: ['I am worried about my exam', 'I studied hard though'],
          expectedCrisis: false,
        },
      ]

      for (const testCase of testCases) {
        const mockProfile: PatientPsiProfile = {
          id: `test-${Date.now()}`,
          name: 'Validation Test',
          age: 25,
          gender: 'female',
          communicationStyle: {
            primary: 'anxious',
            patterns: [],
            triggers: [],
            preferredApproach: [],
          },
          therapeuticGoals: [],
          culturalFactors: { primaryFactors: [] },
          presentingIssues: [],
          history: [],
          preferences: {
            sessionLength: 50,
            communicationMethod: 'text',
            interventionStyle: 'gentle',
          },
          riskFactors: { suicideRisk: 0.2, selfHarm: 0.1 },
        }

        const result = await contextualEnhancer.enhanceContext(
          `validation-${Date.now()}`,
          testCase.emotion,
          mockProfile,
          testCase.conversation,
        )

        expect(result.interventionTiming.shouldIntervene).toBe(
          testCase.expectedCrisis,
        )
      }
    })
  })
})
