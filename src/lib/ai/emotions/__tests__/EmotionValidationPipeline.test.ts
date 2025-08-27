// EmotionValidationPipeline.test.ts
import { describe, it, expect } from '@jest/globals'
import { EmotionValidationPipeline } from '../EmotionValidationPipeline'

describe('EmotionValidationPipeline', () => {
  const pipeline = new EmotionValidationPipeline()

  it('mitigates bias in obviously biased input', () => {
    const input = {
      text: "Clearly, everyone from group X has the same feelings.",
      context: { conversationId: "c1" },
      emotion: "joy"
    }
    const result = pipeline.validateEmotionResult(input)
    expect(result.mitigated).toBe(true)
    expect(result.outputText).toContain('[BIAS-MITIGATED]')
    expect(result.biasMitigationTrace).toBeDefined()
    expect(result.biasMitigationTrace!.foundBias).toBe(true)
  })

  it('assigns high authenticity to first-person, feeling-based statements', () => {
    const input = {
      text: "I feel really proud of myself today.",
      context: { conversationId: "c2" },
      emotion: "pride"
    }
    const result = pipeline.validateEmotionResult(input)
    expect(result.authenticityScore).toBeGreaterThanOrEqual(0.8)
    expect(result.biasMitigationTrace!.foundBias).toBe(false)
    expect(result.outputText).toContain("I feel")
  })

  it('penalizes generic or inauthentic content', () => {
    const input = {
      text: "lorem ipsum dolor sit amet",
      context: { conversationId: "c3" },
      emotion: "confusion"
    }
    const result = pipeline.validateEmotionResult(input)
    expect(result.authenticityScore).toBeLessThanOrEqual(0.3)
    expect(result.outputText).toContain('lorem ipsum')
  })

  it('has confidence that incorporates both authenticity and mitigation', () => {
    const input = {
      text: "Despite stereotypes, everyone is unique.",
      context: { conversationId: "c4" },
      emotion: "curiosity"
    }
    const result = pipeline.validateEmotionResult(input)
    expect(result.confidence).toBeGreaterThan(0)
    expect(typeof result.confidence).toBe('number')
    expect(result).toHaveProperty('authenticityScore')
  })

  it('produces non-mitigated output when bias not present', () => {
    const input = {
      text: "I am feeling optimistic about tomorrow.",
      context: { conversationId: "c5" },
      emotion: "optimism"
    }
    const result = pipeline.validateEmotionResult(input)
    expect(result.mitigated).toBe(false)
    expect(result.outputText).toBe(input.text)
  })

  it('always outputs a biasMitigationTrace object', () => {
    const input = {
      text: "Random neutral sentence.",
      context: { conversationId: "c6" },
      emotion: "neutral"
    }
    const result = pipeline.validateEmotionResult(input)
    expect(result.biasMitigationTrace).toBeDefined()
    expect(typeof result.biasMitigationTrace!.foundBias).toBe('boolean')
  })

  it('number fields are within [0,1] range when appropriate', () => {
    const input = {
      text: "I feel okay.",
      context: { conversationId: "c7" },
      emotion: "okay"
    }
    const result = pipeline.validateEmotionResult(input)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.authenticityScore).toBeGreaterThanOrEqual(0)
    expect(result.authenticityScore).toBeLessThanOrEqual(1)
  })
})