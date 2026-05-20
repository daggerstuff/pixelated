import { describe, it, expect } from 'vitest'

import {
  analyzeTherapeuticTechniques,
  getTherapeuticPrompts,
  processRecognizedSpeech,
} from '../speechRecognition'

describe('processRecognizedSpeech', () => {
  it('handles empty string gracefully', () => {
    const result = processRecognizedSpeech('', 'depression')
    expect(result.processedText).toBe('')
    expect(result.detectedKeywords).toEqual([])
    expect(result.confidenceScores).toEqual({})
  })

  it('cleans up whitespace and filler words', () => {
    // Only tests what the regex currently supports (removing single leading filler word)
    const result = processRecognizedSpeech('  um   I feel sad   ', 'depression')
    expect(result.processedText).toBe('I feel sad')
    expect(result.detectedKeywords).toContain('sad')
    expect(result.confidenceScores).toHaveProperty('sad')
    expect(result.confidenceScores['sad']).toBeGreaterThanOrEqual(0.7)
    expect(result.confidenceScores['sad']).toBeLessThanOrEqual(1.0)
  })
})

describe('analyzeTherapeuticTechniques', () => {
  it('returns empty object when no therapeutic techniques are detected', () => {
    const result = analyzeTherapeuticTechniques(
      'just a normal conversation without any therapeutic patterns',
    )
    expect(result).toEqual({})
  })
})

describe('getTherapeuticPrompts', () => {
  it('returns domain-specific general prompts when detectedKeywords is empty', () => {
    const prompts = getTherapeuticPrompts([], 'anxiety')
    expect(prompts.length).toBeGreaterThan(0)
    // Check if the prompt is from the anxiety general prompts
    const validPrompts = [
      'How has anxiety been affecting you lately?',
      'What situations typically trigger your anxiety?',
    ]
    expect(prompts.every((p) => validPrompts.includes(p))).toBe(true)
  })
})
