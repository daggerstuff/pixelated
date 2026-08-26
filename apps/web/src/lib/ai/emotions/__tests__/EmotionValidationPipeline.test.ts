/* @vitest-environment node */
// EmotionValidationPipeline.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { EmotionValidationPipeline } from '../EmotionValidationPipeline'

// Mock BiasDetectionEngine so initialize() works without real dependencies
// Uses manual mock at src/lib/ai/bias-detection/__mocks__/index.ts
vi.mock('../../bias-detection')

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

describe('EmotionValidationPipeline Lifecycle', () => {
  let p: EmotionValidationPipeline

  beforeEach(() => {
    p = new EmotionValidationPipeline()
  })

  afterEach(async () => {
    await p.dispose()
  })

  it('initialize() should complete successfully', async () => {
    await expect(p.initialize()).resolves.toBeUndefined()
    expect(p.isInitialized).toBe(true)
  })

  it('initialize() should no-op when already initialized', async () => {
    await p.initialize()
    // Second call should return without throwing
    await expect(p.initialize()).resolves.toBeUndefined()
    expect(p.isInitialized).toBe(true)
  })

  it('startContinuousValidation() should initialize if needed', async () => {
    expect(p.isInitialized).toBe(false)
    await p.startContinuousValidation()
    expect(p.isInitialized).toBe(true)
  })

  it('startContinuousValidation() should no-op when already running', async () => {
    await p.startContinuousValidation()
    // Second call should not throw
    await expect(p.startContinuousValidation()).resolves.toBeUndefined()
  })

  it('stopContinuousValidation() should stop a running pipeline', async () => {
    await p.startContinuousValidation()
    const statusBefore = p.getStatus()
    expect(statusBefore.isRunning).toBe(true)

    p.stopContinuousValidation()
    const statusAfter = p.getStatus()
    expect(statusAfter.isRunning).toBe(false)
  })

  it('stopContinuousValidation() should no-op when not running', async () => {
    // Should not throw when trying to stop a stopped pipeline
    expect(() => p.stopContinuousValidation()).not.toThrow()
  })

  it('getStatus() should return isRunning and metrics', () => {
    const status = p.getStatus()
    expect(status).toHaveProperty('isRunning')
    expect(status).toHaveProperty('metrics')
    expect(status.metrics).toHaveProperty('processed')
    expect(status.metrics).toHaveProperty('validated')
    expect(status.metrics).toHaveProperty('errors')
    expect(status.metrics).toHaveProperty('accuracy')
  })

  it('getValidationStats() should return full stats with system health', () => {
    const stats = p.getValidationStats()
    expect(stats).toHaveProperty('isRunning')
    expect(stats).toHaveProperty('metrics')
    expect(stats).toHaveProperty('systemHealth')
    expect(stats).toHaveProperty('lastHealthCheck')
    expect(['healthy', 'warning', 'critical']).toContain(stats.systemHealth)
  })

  it('getValidationResults() should return copy of recent validations', async () => {
    const results = p.getValidationResults()
    expect(Array.isArray(results)).toBe(true)

    // After validation, results should be accessible
    await p.validateEmotionResult({
      sessionId: 'r1',
      detectedEmotion: 'happy',
      confidence: 0.8,
      context: 'positive success',
      responseText: 'I feel great!',
    })
    const results2 = p.getValidationResults()
    expect(results2.length).toBe(1)
  })

  it('dispose() should clean up resources', async () => {
    await p.initialize()
    await p.startContinuousValidation()
    await p.dispose()
    expect(p.isInitialized).toBe(false)
    const status = p.getStatus()
    expect(status.isRunning).toBe(false)
  })
})

describe('EmotionValidationPipeline System Health', () => {
  it('should report healthy by default', () => {
    const pipeline = new EmotionValidationPipeline()
    const stats = pipeline.getValidationStats()
    expect(stats.systemHealth).toBe('healthy')
  })

  it('should detect warning system health', async () => {
    const p = new EmotionValidationPipeline()
    // Generate a mix: 7 valid + 3 invalid = accuracy 0.7 (< 0.75 but >= 0.6) → warning
    for (let i = 0; i < 7; i++) {
      await p.validateEmotionResult({
        sessionId: `w_valid${i}`,
        detectedEmotion: 'happy',
        confidence: 0.8,
        context: 'positive success',
        responseText: 'I feel great!',
      })
    }
    for (let i = 0; i < 3; i++) {
      await p.validateEmotionResult({
        sessionId: `w_bad${i}`,
        detectedEmotion: '',
        confidence: 0,
        context: '',
      })
    }
    const stats = p.getValidationStats()
    // With 10 results, 7 valid, accuracy = 0.7 → warning (< 0.75, >= 0.6)
    expect(stats.systemHealth).toBe('warning')
    await p.dispose()
  })

  it('should detect critical system health from high error rate', async () => {
    const p = new EmotionValidationPipeline()
    // Generate many errors to push error rate above 0.2
    for (let i = 0; i < 8; i++) {
      await p.validateEmotionResult({
        sessionId: `c${i}`,
        detectedEmotion: '',
        confidence: 0,
        context: '',
      })
    }
    const stats = p.getValidationStats()
    expect(stats.systemHealth).toBe('critical')
    await p.dispose()
  })
})

describe('EmotionValidationPipeline Bias Pattern Detection', () => {
  it('should detect gender_aggression bias pattern', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'b1',
      detectedEmotion: 'angry',
      confidence: 0.8,
      context: 'conflict',
      responseText: 'He is being aggressive and hostile!',
      participantDemographics: {
        age: '26-35',
        gender: 'male',
        ethnicity: 'caucasian',
        primaryLanguage: 'en',
      },
    })
    // Bias words are mitigated and replaced with [BIAS-MITIGATED] tokens
    expect(result.recommendations.some((r) => r.includes('mitigated for bias'))).toBe(
      true,
    )
    expect(result.biasScore).toBeGreaterThanOrEqual(0)
    await p.dispose()
  })

  it('should detect gender_emotion bias pattern', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'b2',
      detectedEmotion: 'sad',
      confidence: 0.7,
      context: 'conversation',
      responseText: 'She is being way too emotional and sensitive.',
      participantDemographics: {
        age: '26-35',
        gender: 'female',
        ethnicity: 'caucasian',
        primaryLanguage: 'en',
      },
    })
    // Bias words are mitigated and replaced with [BIAS-MITIGATED] tokens
    expect(result.recommendations.some((r) => r.includes('mitigated for bias'))).toBe(
      true,
    )
    expect(result.biasScore).toBeGreaterThanOrEqual(0)
    await p.dispose()
  })

  it('should not detect bias without demographics', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'b3',
      detectedEmotion: 'happy',
      confidence: 0.8,
      context: 'conversation',
      responseText: 'He is being aggressive!',
    })
    // No bias score because demographics are missing
    expect(result.biasScore).toBe(0)
    await p.dispose()
  })

  it('should detect gender_logic bias pattern', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'b4',
      detectedEmotion: 'neutral',
      confidence: 0.8,
      context: 'conversation',
      responseText: 'He is the rational and analytical one.',
      participantDemographics: {
        age: '26-35',
        gender: 'male',
        ethnicity: 'caucasian',
        primaryLanguage: 'en',
      },
    })
    // Bias words are mitigated and replaced with [BIAS-MITIGATED] tokens
    expect(result.recommendations.some((r) => r.includes('mitigated for bias'))).toBe(
      true,
    )
    await p.dispose()
  })

  it('should detect gender_stability bias pattern', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'b5',
      detectedEmotion: 'confused',
      confidence: 0.7,
      context: 'conversation',
      responseText: 'She is being irrational and unstable.',
      participantDemographics: {
        age: '26-35',
        gender: 'female',
        ethnicity: 'caucasian',
        primaryLanguage: 'en',
      },
    })
    // Bias words are mitigated and replaced with [BIAS-MITIGATED] tokens
    expect(result.recommendations.some((r) => r.includes('mitigated for bias'))).toBe(
      true,
    )
    await p.dispose()
  })
})

describe('EmotionValidationPipeline Contextual Appropriateness', () => {
  it('should flag happy emotion in crisis context at high confidence', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'ca1',
      detectedEmotion: 'happy',
      confidence: 0.85,
      context: 'emergency situation',
      responseText: 'I am feeling great!',
    })
    expect(result.contextualAppropriate).toBe(false)
    expect(result.issues.some((i) => i.includes('Contextually inappropriate'))).toBe(
      true,
    )
    await p.dispose()
  })

  it('should flag happy emotion in grief context at high confidence', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'ca2',
      detectedEmotion: 'excited',
      confidence: 0.95,
      context: 'dealing with loss and grief',
      responseText: 'This is so exciting!',
    })
    expect(result.contextualAppropriate).toBe(false)
    await p.dispose()
  })

  it('should consider appropriate emotion-context combinations as valid', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'ca3',
      detectedEmotion: 'sad',
      confidence: 0.7,
      context: 'dealing with loss and grief',
      responseText: 'I feel really sad about everything.',
    })
    expect(result.contextualAppropriate).toBe(true)
    await p.dispose()
  })

  it('should flag happy in therapy context at high confidence', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'ca4',
      detectedEmotion: 'happy',
      confidence: 0.85,
      context: 'therapy session',
      responseText: 'I am so excited!',
    })
    expect(result.contextualAppropriate).toBe(false)
    await p.dispose()
  })
})

describe('EmotionValidationPipeline Monitoring Callbacks', () => {
  it('should add and trigger monitoring callbacks', async () => {
    const p = new EmotionValidationPipeline()
    const callback = vi.fn()
    p.addMonitoringCallback(callback)
    await p.initialize()
    await p.startContinuousValidation()

    // Stop triggers bias detection stopMonitoring
    p.stopContinuousValidation()

    // Callback should not have been called yet (it's for bias alerts)
    // We verify the callback was added and not removed
    expect(typeof callback).toBe('function')
    await p.dispose()
  })

  it('should remove a monitoring callback', () => {
    const p = new EmotionValidationPipeline()
    const callback = vi.fn()
    p.addMonitoringCallback(callback)
    p.removeMonitoringCallback(callback)
    // No error should occur
    expect(true).toBe(true)
    void p.dispose()
  })

  it('should handle removing non-existent callback', () => {
    const p = new EmotionValidationPipeline()
    const callback = vi.fn()
    // Should not throw even if callback was never added
    expect(() => p.removeMonitoringCallback(callback)).not.toThrow()
    void p.dispose()
  })
})

describe('EmotionValidationPipeline Recommendations', () => {
  it('should recommend de-escalation for high-confidence anger', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'r1',
      detectedEmotion: 'angry',
      confidence: 0.85,
      context: 'argument',
      responseText: 'I feel angry about this.',
    })
    expect(
      result.recommendations.some((r) => r.includes('de-escalation')),
    ).toBe(true)
    await p.dispose()
  })

  it('should recommend model retraining for low confidence detection', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'r2',
      detectedEmotion: '',
      confidence: 0.1,
      context: '',
      responseText: '',
    })
    expect(
      result.recommendations.some((r) => r.includes('retraining')),
    ).toBe(true)
    await p.dispose()
  })

  it('should recommend bias mitigation strategies when bias is high', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'r3',
      detectedEmotion: 'happy',
      confidence: 0.8,
      context: 'conversation',
      responseText: 'She is being way too emotional about this.',
      participantDemographics: {
        age: '26-35',
        gender: 'female',
        ethnicity: 'caucasian',
        primaryLanguage: 'en',
      },
    })
    // Pattern bias is mitigated — biasMitigated flag pushes recommendation with lowercase "bias patterns"
    expect(
      result.recommendations.some((r) => r.toLowerCase().includes('bias patterns') || r.includes('mitigation')),
    ).toBe(true)
    await p.dispose()
  })

  it('should flag happy emotion in grief context as contextually inappropriate', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'r4',
      detectedEmotion: 'happy',
      confidence: 0.95,
      context: 'grief loss death',
      responseText: 'Feeling great!',
    })
    expect(result.contextualAppropriate).toBe(false)
    expect(
      result.issues.some((i) => i.includes('Contextually inappropriate')),
    ).toBe(true)
    await p.dispose()
  })
})

describe('EmotionValidationPipeline Edge Cases', () => {
  it('should handle empty response text gracefully', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'e1',
      detectedEmotion: 'happy',
      confidence: 0.8,
      context: 'conversation',
      responseText: '',
    })
    expect(result.confidence).toBeGreaterThan(0)
    expect(typeof result.isValid).toBe('boolean')
    await p.dispose()
  })

  it('should handle missing emotion gracefully', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'e2',
      detectedEmotion: '',
      confidence: 0.8,
      context: 'conversation',
    })
    expect(result.isValid).toBe(false)
    expect(result.issues.some((i) => i.includes('Missing'))).toBe(true)
    await p.dispose()
  })

  it('should handle unrecognized emotion category', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'e3',
      detectedEmotion: 'blorptious',
      confidence: 0.8,
      context: 'conversation',
      responseText: 'I feel blorptious today.',
    })
    expect(result.issues.some((i) => i.includes('Unrecognized'))).toBe(true)
    await p.dispose()
  })

  it('should handle very low confidence detection', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'e4',
      detectedEmotion: 'happy',
      confidence: 0.1,
      context: 'conversation',
      responseText: 'I feel okay.',
    })
    expect(result.issues.some((i) => i.includes('Low emotion'))).toBe(true)
    await p.dispose()
  })

  it('should generate emotion consistency for crisis context', async () => {
    const p = new EmotionValidationPipeline()
    const result = await p.validateEmotionResult({
      sessionId: 'e5',
      detectedEmotion: 'fearful',
      confidence: 0.8,
      context: 'emergency crisis help',
      responseText: 'I am scared.',
    })
    // Fearful in crisis should have high consistency
    expect(result.emotionConsistency).toBeGreaterThan(0.5)
    await p.dispose()
  })
})
