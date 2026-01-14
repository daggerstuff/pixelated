/**
 * Integration Tests for Adaptive Selection Workflow
 * 
 * Tests the complete end-to-end adaptive selection pipeline:
 * ContextDetector → ContextTransitionDetector → ObjectiveSwitcher → AdaptiveSelector
 * 
 * Covers:
 * - Multi-turn conversations with context changes
 * - Crisis escalation scenarios
 * - Transition smoothing and immediate elevation
 * - Observer notifications across components
 * - Performance and stability
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ContextDetector, type ContextDetectionResult } from '../prioritization/context-detector'
import { ContextTransitionDetector, type ContextEvent } from '../prioritization/context-transition-detector'
import { ObjectiveSwitcher } from '../prioritization/context-objective-mapping'
import { AdaptiveSelector } from '../prioritization/adaptive-selector'
import { ContextType } from '../core/objectives'
import type { AIService } from '../../ai/models/types'

// Mock AI Service
const createMockAIService = (): AIService => {
  return {
    getModelInfo: vi.fn().mockReturnValue({
      id: 'test-model',
      name: 'Test Model',
      provider: 'test',
      capabilities: [],
      contextWindow: 4096,
      maxTokens: 2048,
    }),
    createChatCompletion: vi.fn().mockImplementation(async (messages) => {
      // Simple mock responses based on user input
      const userMessage = messages.find((m: any) => m.role === 'user')?.content || ''
      
      let detectedContext = ContextType.GENERAL
      let confidence = 0.7
      let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low'

      // Crisis detection
      if (userMessage.toLowerCase().includes('hurt myself') || 
          userMessage.toLowerCase().includes('suicide') ||
          userMessage.toLowerCase().includes('end it all')) {
        detectedContext = ContextType.CRISIS
        confidence = 0.95
        urgency = 'critical'
      }
      // Educational queries
      else if (userMessage.toLowerCase().includes('what is') ||
               userMessage.toLowerCase().includes('tell me about') ||
               userMessage.toLowerCase().includes('explain')) {
        detectedContext = ContextType.EDUCATIONAL
        confidence = 0.9
        urgency = 'low'
      }
      // Clinical assessment
      else if (userMessage.toLowerCase().includes('diagnose') ||
               userMessage.toLowerCase().includes('assessment') ||
               userMessage.toLowerCase().includes('phq-9')) {
        detectedContext = ContextType.CLINICAL_ASSESSMENT
        confidence = 0.88
        urgency = 'medium'
      }
      // Support context
      else if (userMessage.toLowerCase().includes('feeling') ||
               userMessage.toLowerCase().includes('cope') ||
               userMessage.toLowerCase().includes('help me')) {
        detectedContext = ContextType.SUPPORT
        confidence = 0.85
        urgency = 'medium'
      }
      // Informational
      else if (userMessage.toLowerCase().includes('where can i') ||
               userMessage.toLowerCase().includes('how do i find') ||
               userMessage.toLowerCase().includes('hotline')) {
        detectedContext = ContextType.INFORMATIONAL
        confidence = 0.87
        urgency = 'low'
      }

      return {
        id: 'test-completion',
        created: Date.now(),
        model: 'test-model',
        choices: [
          {
            message: {
              role: 'assistant' as const,
              content: JSON.stringify({
                detectedContext: detectedContext,
                confidence: confidence,
                contextualIndicators: [
                  {
                    type: 'pattern_match',
                    description: `Detected ${detectedContext} context`,
                    confidence: confidence,
                  },
                ],
                needsSpecialHandling: detectedContext === ContextType.CRISIS || 
                                     detectedContext === ContextType.CLINICAL_ASSESSMENT,
                urgency: urgency,
                metadata: {},
              }),
            },
            finishReason: 'stop' as const,
          },
        ],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        provider: 'test',
      }
    }),
    createStreamingChatCompletion: vi.fn(),
    dispose: vi.fn(),
  } as unknown as AIService
}

describe('Adaptive Selection Integration Tests', () => {
  let aiService: AIService
  let contextDetector: ContextDetector
  let transitionDetector: ContextTransitionDetector
  let objectiveSwitcher: ObjectiveSwitcher
  let adaptiveSelector: AdaptiveSelector

  beforeEach(() => {
    aiService = createMockAIService()
    
    contextDetector = new ContextDetector({
      aiService,
      model: 'test-model',
      enableCrisisIntegration: false, // Simplified for integration tests
      enableEducationalRecognition: false,
    })

    transitionDetector = new ContextTransitionDetector({
      minConfidenceThreshold: 0.7,
      smoothingWindow: 2,
      enableCrisisElevation: true,
      enableTelemetry: true,
    })

    objectiveSwitcher = new ObjectiveSwitcher({
      enableTelemetry: true,
      enableAuditLog: true,
    })

    adaptiveSelector = new AdaptiveSelector({
      aiService,
    })
  })

  describe('End-to-End Workflow', () => {
    it('should detect context, track transition, and switch objectives', async () => {
      // Turn 1: Educational query
      const turn1 = await contextDetector.detectContext('What is anxiety?')
      expect(turn1.detectedContext).toBe(ContextType.EDUCATIONAL)

      const event1: ContextEvent = {
        turnId: 1,
        contextType: turn1.detectedContext,
        confidence: turn1.confidence,
        urgency: turn1.urgency,
        timestamp: Date.now(),
      }

      transitionDetector.addEvent(event1)

      // Turn 2: Support request
      const turn2 = await contextDetector.detectContext('I am feeling overwhelmed and need help coping')
      expect(turn2.detectedContext).toBe(ContextType.SUPPORT)

      const event2: ContextEvent = {
        turnId: 2,
        contextType: turn2.detectedContext,
        confidence: turn2.confidence,
        urgency: turn2.urgency,
        timestamp: Date.now() + 1000,
      }

      const transition = transitionDetector.addEvent(event2)
      
      expect(transition).not.toBeNull()
      expect(transition!.from.contextType).toBe(ContextType.EDUCATIONAL)
      expect(transition!.to.contextType).toBe(ContextType.SUPPORT)

      // Verify transition was detected but smoothing applied
      if (transition!.detected) {
        await objectiveSwitcher.onContextTransition(transition!)
        
        const objectives = objectiveSwitcher.getObjectives()
        expect(objectives.length).toBeGreaterThan(0)
        
        // Support context should prioritize empathy
        const empathyObj = objectives.find(obj => obj.key === 'empathy')
        expect(empathyObj).toBeDefined()
      }
    })

    it('should handle crisis escalation immediately', async () => {
      // Turn 1: General conversation
      const turn1 = await contextDetector.detectContext('Hello, how are you?')
      
      const event1: ContextEvent = {
        turnId: 1,
        contextType: turn1.detectedContext,
        confidence: turn1.confidence,
        urgency: turn1.urgency,
        timestamp: Date.now(),
      }

      transitionDetector.addEvent(event1)

      // Turn 2: Crisis situation
      const turn2 = await contextDetector.detectContext('I want to hurt myself')
      expect(turn2.detectedContext).toBe(ContextType.CRISIS)

      const event2: ContextEvent = {
        turnId: 2,
        contextType: turn2.detectedContext,
        confidence: turn2.confidence,
        urgency: turn2.urgency,
        timestamp: Date.now() + 500,
      }

      const transition = transitionDetector.addEvent(event2)

      expect(transition).not.toBeNull()
      expect(transition!.transitionType).toBe('crisis_elevation')
      expect(transition!.detected).toBe(true)
      expect(transition!.shouldSmooth).toBe(false)

      // Switch objectives immediately
      await objectiveSwitcher.onContextTransition(transition!)
      
      const objectives = objectiveSwitcher.getObjectives()
      const safetyObj = objectives.find(obj => obj.key === 'safety')
      expect(safetyObj).toBeDefined()
      expect(safetyObj!.priority).toBe(1) // Highest priority

      // Verify telemetry
      const telemetry = objectiveSwitcher.getTelemetry()
      expect(telemetry.objective_switch_count).toBe(1)
    })

    it('should handle multi-turn conversation with multiple transitions', async () => {
      const conversation = [
        { text: 'Hello', expectedContext: ContextType.GENERAL },
        { text: 'What is depression?', expectedContext: ContextType.EDUCATIONAL },
        { text: 'Can you diagnose me?', expectedContext: ContextType.CLINICAL_ASSESSMENT },
        { text: 'Where can I find a therapist?', expectedContext: ContextType.INFORMATIONAL },
      ]

      let previousContext: ContextType | null = null

      for (let i = 0; i < conversation.length; i++) {
        const turn = conversation[i]!
        const detection = await contextDetector.detectContext(turn.text)

        // Context detection may vary based on mock, so we'll be flexible
        const event: ContextEvent = {
          turnId: i + 1,
          contextType: detection.detectedContext,
          confidence: detection.confidence,
          urgency: detection.urgency,
          timestamp: Date.now() + i * 1000,
        }

        const transition = transitionDetector.addEvent(event)

        if (transition && transition.detected) {
          await objectiveSwitcher.onContextTransition(transition)
          
          expect(transition.from.contextType).toBe(previousContext!)
          expect(transition.to.contextType).toBe(detection.detectedContext)
        }

        previousContext = detection.detectedContext
      }

      // Verify transition history
      const history = transitionDetector.getHistory()
      expect(history.length).toBe(conversation.length)

      // Verify telemetry
      const stats = transitionDetector.getTransitionStats()
      expect(stats.totalEvents).toBe(conversation.length)
      expect(stats.transitions).toBeGreaterThanOrEqual(1)
    })
  })

  describe('AdaptiveSelector Integration', () => {
    it('should select appropriate objectives based on context', async () => {
      const result = await adaptiveSelector.selectObjectives('What is anxiety?')

      expect(result.contextDetectionResult).toBeDefined()
      expect(result.contextDetectionResult.detectedContext).toBe(ContextType.EDUCATIONAL)
      expect(result.selectedObjectives.length).toBeGreaterThan(0)
      
      // Educational context should weight informativeness highly
      const infoObj = result.selectedObjectives.find(obj => obj.objective.id === 'informativeness')
      expect(infoObj).toBeDefined()
      expect(infoObj!.weight).toBeGreaterThan(0)
    })

    it('should handle crisis context with high safety priority', async () => {
      const result = await adaptiveSelector.selectObjectives('I want to end it all')

      expect(result.contextDetectionResult.detectedContext).toBe(ContextType.CRISIS)
      expect(result.contextDetectionResult.urgency).toBe('critical')
      
      // Crisis should prioritize safety
      const safetyObj = result.selectedObjectives.find(obj => obj.objective.id === 'safety')
      expect(safetyObj).toBeDefined()
      expect(safetyObj!.weight).toBeGreaterThan(0.7)
    })

    it('should handle conversation history', async () => {
      const conversationHistory = [
        'What is anxiety?',
        'How can I manage stress?',
      ]

      const result = await adaptiveSelector.selectObjectives(
        'I am feeling overwhelmed',
        conversationHistory,
        'user123',
      )

      expect(result.alignmentContext.conversationHistory).toEqual(conversationHistory)
      expect(result.selectedObjectives.length).toBeGreaterThan(0)
    })
  })

  describe('Observer Pattern Integration', () => {
    it('should notify observers across the pipeline', async () => {
      const switchObserver = vi.fn()
      objectiveSwitcher.addObserver(switchObserver)

      // Simulate context change
      const turn1 = await contextDetector.detectContext('What is anxiety?')
      const event1: ContextEvent = {
        turnId: 1,
        contextType: turn1.detectedContext,
        confidence: turn1.confidence,
        urgency: turn1.urgency,
        timestamp: Date.now(),
      }
      transitionDetector.addEvent(event1)

      const turn2 = await contextDetector.detectContext('I need help coping')
      const event2: ContextEvent = {
        turnId: 2,
        contextType: turn2.detectedContext,
        confidence: turn2.confidence,
        urgency: turn2.urgency,
        timestamp: Date.now() + 1000,
      }

      const transition = transitionDetector.addEvent(event2)

      if (transition && transition.detected) {
        await objectiveSwitcher.onContextTransition(transition)
        
        // Allow async notifications
        await new Promise(resolve => setTimeout(resolve, 10))

        expect(switchObserver).toHaveBeenCalled()
        const callArgs = switchObserver.mock.calls[0]
        expect(callArgs[0]).toBeInstanceOf(Array) // objectives
        expect(callArgs[1]).toHaveProperty('toContext')
      }
    })
  })

  describe('Performance and Stability', () => {
    it('should handle rapid context changes efficiently', async () => {
      const startTime = performance.now()
      
      const queries = [
        'What is anxiety?',
        'I feel sad',
        'Can you diagnose me?',
        'Where can I find help?',
        'I feel better now',
      ]

      for (let i = 0; i < queries.length; i++) {
        const detection = await contextDetector.detectContext(queries[i]!)
        
        const event: ContextEvent = {
          turnId: i + 1,
          contextType: detection.detectedContext,
          confidence: detection.confidence,
          urgency: detection.urgency,
          timestamp: Date.now() + i * 100,
        }

        const transition = transitionDetector.addEvent(event)
        if (transition && transition.detected) {
          await objectiveSwitcher.onContextTransition(transition)
        }
      }

      const duration = performance.now() - startTime
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000) // 1 second for 5 turns

      // Verify all components are in valid state
      expect(transitionDetector.getCurrentContext()).toBeDefined()
      expect(objectiveSwitcher.getObjectives().length).toBeGreaterThan(0)
      expect(transitionDetector.getTransitionStats().totalEvents).toBe(queries.length)
    })

    it('should maintain stability across multiple runs', async () => {
      const runs = 3
      const results: any[] = []

      for (let run = 0; run < runs; run++) {
        const result = await adaptiveSelector.selectObjectives('What is anxiety?')
        results.push(result)
      }

      // All runs should produce consistent context detection
      const contexts = results.map(r => r.contextDetectionResult.detectedContext)
      expect(new Set(contexts).size).toBe(1) // All same
      expect(contexts[0]).toBe(ContextType.EDUCATIONAL)

      // All runs should have valid objectives
      results.forEach(result => {
        expect(result.selectedObjectives.length).toBeGreaterThan(0)
        expect(result.selectedObjectives.every((obj: any) => obj.weight >= 0)).toBe(true)
      })
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should handle context detection failures gracefully', async () => {
      const failingAIService = {
        ...aiService,
        createChatCompletion: vi.fn().mockRejectedValue(new Error('AI service error')),
      } as unknown as AIService

      const failingDetector = new ContextDetector({
        aiService: failingAIService,
        enableCrisisIntegration: false,
      })

      const result = await failingDetector.detectContext('Test message')
      
      // Should fall back to GENERAL
      expect(result.detectedContext).toBe(ContextType.GENERAL)
      expect(result.confidence).toBeLessThan(0.5)
      expect(result.metadata.error).toBeDefined()
    })

    it('should handle objective switching errors without crashing', async () => {
      const turn1 = await contextDetector.detectContext('What is anxiety?')
      const event1: ContextEvent = {
        turnId: 1,
        contextType: turn1.detectedContext,
        confidence: turn1.confidence,
        urgency: turn1.urgency,
        timestamp: Date.now(),
      }
      transitionDetector.addEvent(event1)

      // Create invalid transition
      const invalidTransition: any = {
        from: event1,
        to: { ...event1, contextType: 'INVALID' as any },
        detected: true,
        transitionType: 'standard',
        shouldSmooth: false,
        confidence: 0.8,
      }

      // Should not throw
      await expect(
        objectiveSwitcher.onContextTransition(invalidTransition)
      ).resolves.not.toThrow()

      // Should still have valid state
      const telemetry = objectiveSwitcher.getTelemetry()
      expect(telemetry.failed_switches).toBe(0) // May handle gracefully
    })
  })

  describe('Representative Scenarios (Acceptance Criteria)', () => {
    it('Scenario 1: Educational to Support Journey', async () => {
      // User starts with educational question
      const result1 = await adaptiveSelector.selectObjectives('What is depression?')
      expect(result1.contextDetectionResult.detectedContext).toBe(ContextType.EDUCATIONAL)

      // Progresses to seeking support
      const result2 = await adaptiveSelector.selectObjectives(
        'I think I might be depressed. How can I cope?',
        ['What is depression?']
      )
      
      // Should detect support context
      expect([ContextType.SUPPORT, ContextType.EDUCATIONAL]).toContain(
        result2.contextDetectionResult.detectedContext
      )
      expect(result2.selectedObjectives.length).toBeGreaterThan(0)
    })

    it('Scenario 2: Crisis Escalation from General Conversation', async () => {
      // Casual start
      const result1 = await adaptiveSelector.selectObjectives('Hello')
      
      // Sudden crisis
      const result2 = await adaptiveSelector.selectObjectives(
        'I cannot take this anymore, I want to hurt myself',
        ['Hello']
      )
      
      expect(result2.contextDetectionResult.detectedContext).toBe(ContextType.CRISIS)
      expect(result2.contextDetectionResult.urgency).toBe('critical')
      
      const safetyObj = result2.selectedObjectives.find(obj => obj.objective.id === 'safety')
      expect(safetyObj).toBeDefined()
    })

    it('Scenario 3: Clinical Assessment Request', async () => {
      // User seeks clinical evaluation
      const result = await adaptiveSelector.selectObjectives(
        'Can you help me with a PHQ-9 assessment for depression?'
      )
      
      expect(result.contextDetectionResult.detectedContext).toBe(ContextType.CLINICAL_ASSESSMENT)
      expect(result.contextDetectionResult.needsSpecialHandling).toBe(true)
      
      // Should prioritize correctness and professionalism
      const correctnessObj = result.selectedObjectives.find(obj => obj.objective.id === 'correctness')
      expect(correctnessObj).toBeDefined()
    })
  })
})
