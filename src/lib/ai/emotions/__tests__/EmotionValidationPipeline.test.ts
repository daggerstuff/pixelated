// EmotionValidationPipeline.test.ts
import { describe, it, expect } from 'vitest'
import { EmotionValidationPipeline } from '../EmotionValidationPipeline'

describe('EmotionValidationPipeline', () => {
  const pipeline = new EmotionValidationPipeline()

  it('mitigates bias in obviously biased input', async () => {
    const input = {
      sessionId: 'c1',
      detectedEmotion: 'joy',
      confidence: 0.8,
      context: 'conversation',
      responseText: 'Clearly, everyone from group X has the same feelings.',
      participantDemographics: {
        age: '26-35',
        gender: 'female',
        ethnicity: 'other',
        primaryLanguage: 'en',
      },
    }
    const result = await pipeline.validateEmotionResult(input)
    expect(result.biasScore).toBeDefined()
    expect(result.isValid).toBe(false)
  })

  it('assigns high authenticity to first-person, feeling-based statements', async () => {
    const input = {
      sessionId: 'c2',
      detectedEmotion: 'pride',
      confidence: 0.9,
      context: 'conversation',
      responseText: 'I feel really proud of myself today.',
    }
    const result = await pipeline.validateEmotionResult(input)
    expect(result.authenticityScore).toBeGreaterThanOrEqual(0.8)
    expect(result.biasScore).toBeLessThan(0.3)
  })

  it('penalizes generic or inauthentic content', async () => {
    const input = {
      sessionId: 'c3',
      detectedEmotion: 'confusion',
      confidence: 0.5,
      context: 'conversation',
      responseText: 'lorem ipsum dolor sit amet',
    }
    const result = await pipeline.validateEmotionResult(input)
    expect(result.authenticityScore).toBeLessThanOrEqual(0.3)
    expect(result.isValid).toBe(false)
  })

  it('has confidence that incorporates both authenticity and mitigation', async () => {
    const input = {
      sessionId: 'c4',
      detectedEmotion: 'curiosity',
      confidence: 0.7,
      context: 'conversation',
      responseText: 'Despite stereotypes, everyone is unique.',
    }
    const result = await pipeline.validateEmotionResult(input)
    expect(result.confidence).toBeGreaterThan(0)
    expect(typeof result.confidence).toBe('number')
    expect(result).toHaveProperty('authenticityScore')
  })

  it('produces non-mitigated output when bias not present', async () => {
    const input = {
      sessionId: 'c5',
      detectedEmotion: 'happy',
      confidence: 0.8,
      context: 'positive success',
      responseText: 'I am feeling optimistic about tomorrow.',
    }
    const result = await pipeline.validateEmotionResult(input)
    expect(result.biasScore).toBeLessThan(0.3)
    expect(result.isValid).toBe(true)
  })

  it('always outputs a biasMitigationTrace object', async () => {
    const input = {
      sessionId: 'c6',
      detectedEmotion: 'neutral',
      confidence: 0.6,
      context: 'conversation',
      responseText: 'Random neutral sentence.',
    }
    const result = await pipeline.validateEmotionResult(input)
    expect(result.biasScore).toBeDefined()
    expect(typeof result.biasScore).toBe('number')
  })

  it('number fields are within [0,1] range when appropriate', async () => {
    const input = {
      sessionId: 'c7',
      detectedEmotion: 'happy',
      confidence: 0.7,
      context: 'neutral',
      responseText: 'I feel okay.',
    }
    const result = await pipeline.validateEmotionResult(input)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.authenticityScore).toBeGreaterThanOrEqual(0)
    expect(result.authenticityScore).toBeLessThanOrEqual(1)
  })
})
