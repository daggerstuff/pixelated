import { describe, it, expect, beforeEach } from 'vitest'
import { MentalHealthService } from '../service'
import type { ChatMessage } from '../types'

describe('MentalHealthService', () => {
  let service: MentalHealthService
  const conversationId = 'test-conversation'

  beforeEach(() => {
    service = new MentalHealthService({
      enableAnalysis: true,
      confidenceThreshold: 0.5,
      interventionThreshold: 0.7,
      analysisMinLength: 5,
      enableCrisisDetection: true,
    })
  })

  describe('processMessage', () => {
    it('should process user messages with analysis', async () => {
      const message: Omit<ChatMessage, 'analysis'> = {
        id: 'test-1',
        role: 'user',
        content: 'I feel really depressed and hopeless today',
        timestamp: Date.now(),
      }

      const result = await service.processMessage(conversationId, message)

      expect(result.id).toBe('test-1')
      expect(result.analysis).toBeDefined()
      expect(result.analysis?.riskLevel).toBe('medium')
      expect(result.analysis?.indicators).toHaveLength(1)
      expect(result.analysis?.indicators[0].type).toBe('depression')
    })

    it('should not analyze short messages', async () => {
      const message: Omit<ChatMessage, 'analysis'> = {
        id: 'test-2',
        role: 'user',
        content: 'Hi',
        timestamp: Date.now(),
      }

      const result = await service.processMessage(conversationId, message)

      expect(result.analysis).toBeUndefined()
    })

    it('should detect crisis situations', async () => {
      const message: Omit<ChatMessage, 'analysis'> = {
        id: 'test-4',
        role: 'user',
        content: 'I want to kill myself and end it all',
        timestamp: Date.now(),
      }

      const result = await service.processMessage(conversationId, message)

      expect(result.analysis?.riskLevel).toBe('critical')
      expect(result.analysis?.requiresIntervention).toBe(true)
      expect(result.analysis?.indicators.some((i) => i.type === 'crisis')).toBe(
        true,
      )
    })
  })

  describe('generateTherapeuticResponse', () => {
    it('should generate crisis response for high-risk situations', async () => {
      const message: Omit<ChatMessage, 'analysis'> = {
        id: 'test-5',
        role: 'user',
        content: 'I want to hurt myself',
        timestamp: Date.now(),
      }

      await service.processMessage(conversationId, message)
      const response = await service.generateTherapeuticResponse(conversationId)

      expect(response.approach).toBe('crisis')
      expect(response.content).toContain('concerned')
      expect(response.techniques).toContain('Crisis intervention')
    })
  })

  describe('needsIntervention', () => {
    it('should return true for critical risk levels', async () => {
      const message: Omit<ChatMessage, 'analysis'> = {
        id: 'test-7',
        role: 'user',
        content: 'I want to kill myself',
        timestamp: Date.now(),
      }

      await service.processMessage(conversationId, message)

      expect(service.needsIntervention(conversationId)).toBe(true)
    })

    it('should return false for low risk levels', async () => {
      const message: Omit<ChatMessage, 'analysis'> = {
        id: 'test-8',
        role: 'user',
        content: 'I feel okay today',
        timestamp: Date.now(),
      }

      await service.processMessage(conversationId, message)

      expect(service.needsIntervention(conversationId)).toBe(false)
    })
  })
})
